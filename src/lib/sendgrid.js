import { sleep } from "./helpers.js";

export async function setupSendGridDomainAuth(domain, sendgridApiKey) {
  const cfKey = process.env.CLOUDFLARE_API_KEY?.trim();
  const cfEmail = process.env.CLOUDFLARE_EMAIL?.trim();

  if (!cfKey || !cfEmail) {
    return {
      ok: false,
      output: "[sendgrid-domain] Cloudflare credentials not available",
    };
  }

  const sgHeaders = {
    Authorization: `Bearer ${sendgridApiKey}`,
    "Content-Type": "application/json",
  };

  const cfHeaders = {
    "X-Auth-Email": cfEmail,
    "X-Auth-Key": cfKey,
    "Content-Type": "application/json",
  };

  let output = "";

  try {
    output += `[sendgrid-domain] Checking for existing domain authentication...\n`;
    const existingDomainsRes = await fetch(
      "https://api.sendgrid.com/v3/whitelabel/domains",
      { headers: sgHeaders },
    );
    if (!existingDomainsRes.ok) {
      const errText = await existingDomainsRes.text();
      return {
        ok: false,
        output: `SendGrid API error (${existingDomainsRes.status}): ${errText}`,
      };
    }
    const existingDomains = await existingDomainsRes.json();
    if (!Array.isArray(existingDomains)) {
      return {
        ok: false,
        output: `SendGrid API returned unexpected response: ${JSON.stringify(existingDomains)}`,
      };
    }

    let domainId = null;
    let dnsRecords = null;

    const existing = existingDomains.find((d) => d.domain === domain);
    if (existing) {
      output += `[sendgrid-domain] Found existing domain auth (ID: ${existing.id})\n`;
      domainId = existing.id;
      dnsRecords = existing.dns;
    } else {
      output += `[sendgrid-domain] Creating domain authentication for ${domain}...\n`;
      const createRes = await fetch(
        "https://api.sendgrid.com/v3/whitelabel/domains",
        {
          method: "POST",
          headers: sgHeaders,
          body: JSON.stringify({
            domain,
            automatic_security: true,
            default: true,
          }),
        },
      );

      if (!createRes.ok) {
        const errorText = await createRes.text();
        return {
          ok: false,
          output:
            output +
            `[sendgrid-domain] Failed to create domain: ${errorText}`,
        };
      }

      const createData = await createRes.json();
      domainId = createData.id;
      dnsRecords = createData.dns;
      output += `[sendgrid-domain] Domain auth created (ID: ${domainId})\n`;
    }

    output += `[sendgrid-domain] Looking up Cloudflare zone for ${domain}...\n`;
    const zoneRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
      { headers: cfHeaders },
    );
    if (!zoneRes.ok) {
      const errText = await zoneRes.text();
      return {
        ok: false,
        output:
          output +
          `[sendgrid-domain] Cloudflare API error (${zoneRes.status}): ${errText}\n`,
      };
    }
    const zoneData = await zoneRes.json();

    if (!zoneData.success || !zoneData.result?.length) {
      return {
        ok: false,
        output:
          output +
          `[sendgrid-domain] Domain ${domain} not found in Cloudflare account\n`,
      };
    }

    const zoneId = zoneData.result[0].id;
    output += `[sendgrid-domain] Cloudflare zone found: ${zoneId}\n`;

    const existingDnsRes = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      { headers: cfHeaders },
    );
    if (!existingDnsRes.ok) {
      const errText = await existingDnsRes.text();
      return {
        ok: false,
        output:
          output +
          `[sendgrid-domain] Failed to fetch DNS records (${existingDnsRes.status}): ${errText}\n`,
      };
    }
    const existingDnsData = await existingDnsRes.json();
    const existingRecords = existingDnsData.result || [];

    const recordsToCreate = [
      { key: "mail_cname", record: dnsRecords.mail_cname },
      { key: "dkim1", record: dnsRecords.dkim1 },
      { key: "dkim2", record: dnsRecords.dkim2 },
    ];

    for (const { key, record } of recordsToCreate) {
      if (!record) {
        output += `[sendgrid-domain] Warning: ${key} record not provided by SendGrid\n`;
        continue;
      }

      const existingRec = existingRecords.find(
        (r) =>
          r.name === record.host &&
          r.type.toUpperCase() === record.type.toUpperCase(),
      );

      if (existingRec) {
        const updateRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingRec.id}`,
          {
            method: "PUT",
            headers: cfHeaders,
            body: JSON.stringify({
              type: record.type.toUpperCase(),
              name: record.host,
              content: record.data,
              proxied: false,
            }),
          },
        );
        const updateData = await updateRes.json();
        output += `[sendgrid-domain] Updated ${key}: ${record.host} → ${record.data} (${updateData.success ? "OK" : "FAILED"})\n`;
      } else {
        const createRes = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
          {
            method: "POST",
            headers: cfHeaders,
            body: JSON.stringify({
              type: record.type.toUpperCase(),
              name: record.host,
              content: record.data,
              proxied: false,
            }),
          },
        );
        const createData = await createRes.json();
        output += `[sendgrid-domain] Created ${key}: ${record.host} → ${record.data} (${createData.success ? "OK" : "FAILED"})\n`;
      }
    }

    output += `[sendgrid-domain] Waiting for DNS propagation...\n`;
    let validated = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      await sleep(5000);

      output += `[sendgrid-domain] Validation attempt ${attempt}/3...\n`;
      const validateRes = await fetch(
        `https://api.sendgrid.com/v3/whitelabel/domains/${domainId}/validate`,
        { method: "POST", headers: sgHeaders },
      );

      if (!validateRes.ok) {
        const errorText = await validateRes.text();
        output += `[sendgrid-domain] Validation API error (${validateRes.status}): ${errorText}\n`;
        continue;
      }

      const validateData = await validateRes.json();

      if (validateData.valid) {
        validated = true;
        output += `[sendgrid-domain] ✓ Domain validation successful!\n`;
        break;
      } else {
        output += `[sendgrid-domain] Validation pending (DNS may need more time to propagate)\n`;
        if (validateData.validation_results) {
          output += `[sendgrid-domain] Details: ${JSON.stringify(validateData.validation_results)}\n`;
        }
      }
    }

    if (!validated) {
      output += `[sendgrid-domain] ⚠️  Domain not yet validated - DNS records created but may need more time to propagate\n`;
    }

    output += `[sendgrid-domain] Registering verified sender...\n`;
    const senderEmail = `noreply@${domain}`;

    const verifiedSenderRes = await fetch(
      "https://api.sendgrid.com/v3/verified_senders",
      {
        method: "POST",
        headers: sgHeaders,
        body: JSON.stringify({
          nickname: "Gerald Dashboard",
          from_email: senderEmail,
          from_name: "Gerald Dashboard",
          reply_to: senderEmail,
          reply_to_name: "Gerald Dashboard",
          address: "123 Main St",
          city: "Edmonton",
          state: "AB",
          zip: "T5A0A1",
          country: "CA",
        }),
      },
    );

    if (verifiedSenderRes.ok) {
      output += `[sendgrid-domain] ✓ Verified sender registered: ${senderEmail}\n`;
    } else {
      const errorText = await verifiedSenderRes.text();
      if (
        errorText.includes("already exists") ||
        errorText.includes("duplicate")
      ) {
        output += `[sendgrid-domain] Verified sender already exists: ${senderEmail}\n`;
      } else {
        output += `[sendgrid-domain] ⚠️  Failed to register verified sender (${verifiedSenderRes.status}): ${errorText}\n`;
      }
    }

    return { ok: true, validated, output };
  } catch (err) {
    return {
      ok: false,
      output: output + `[sendgrid-domain] Error: ${err.message}\n`,
    };
  }
}
