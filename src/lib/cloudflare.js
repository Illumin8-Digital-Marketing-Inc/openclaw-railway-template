export async function setupCloudflareDNS(domain, railwayDomain) {
  const cfKey = process.env.CLOUDFLARE_API_KEY?.trim();
  const cfEmail = process.env.CLOUDFLARE_EMAIL?.trim();
  if (!cfKey || !cfEmail) {
    return {
      ok: false,
      output:
        "Cloudflare API key or email not set in environment variables",
    };
  }

  const cfHeaders = {
    "X-Auth-Email": cfEmail,
    "X-Auth-Key": cfKey,
    "Content-Type": "application/json",
  };

  let output = "";

  const apexDomain = domain.replace(/^www\./, "");
  if (domain !== apexDomain) {
    output += `Normalized domain: ${domain} → ${apexDomain} (for subdomain creation)\n`;
  }

  const zoneRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${apexDomain}`,
    { headers: cfHeaders },
  );
  const zoneData = await zoneRes.json();

  if (!zoneData.success || !zoneData.result?.length) {
    return {
      ok: false,
      output: `Domain ${apexDomain} not found in Cloudflare account. Add it to Cloudflare first.`,
    };
  }

  const zoneId = zoneData.result[0].id;
  output += `Zone found: ${zoneId}\n`;

  const existingRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    { headers: cfHeaders },
  );
  const existingData = await existingRes.json();
  const existingRecords = existingData.result || [];

  const records = [
    { name: apexDomain, type: "CNAME" },
    { name: `www.${apexDomain}`, type: "CNAME" },
    { name: `dev.${apexDomain}`, type: "CNAME" },
    { name: `gerald.${apexDomain}`, type: "CNAME" },
  ];

  for (const record of records) {
    const content = record.content || railwayDomain;
    const existing = existingRecords.find(
      (r) => r.name === record.name && r.type === record.type,
    );

    if (existing) {
      const updateRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existing.id}`,
        {
          method: "PUT",
          headers: cfHeaders,
          body: JSON.stringify({
            type: record.type,
            name: record.name,
            content,
            proxied: true,
          }),
        },
      );
      const updateData = await updateRes.json();
      output += `Updated ${record.name} → ${content} (${updateData.success ? "OK" : JSON.stringify(updateData.errors)})\n`;
    } else {
      const createRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
        {
          method: "POST",
          headers: cfHeaders,
          body: JSON.stringify({
            type: record.type,
            name: record.name,
            content,
            proxied: true,
          }),
        },
      );
      const createData = await createRes.json();
      output += `Created ${record.name} → ${content} (${createData.success ? "OK" : JSON.stringify(createData.errors)})\n`;
    }
  }

  return { ok: true, output, zoneId };
}

export async function createTurnstileWidget(domain, zoneId) {
  const cfKey = process.env.CLOUDFLARE_API_KEY?.trim();
  const cfEmail = process.env.CLOUDFLARE_EMAIL?.trim();
  if (!cfKey || !cfEmail) {
    return { ok: false, output: "Cloudflare credentials not available" };
  }

  const cfHeaders = {
    "X-Auth-Email": cfEmail,
    "X-Auth-Key": cfKey,
    "Content-Type": "application/json",
  };

  const zoneRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}`,
    { headers: cfHeaders },
  );
  const zoneData = await zoneRes.json();
  const accountId = zoneData.result?.account?.id;

  if (!accountId) {
    return {
      ok: false,
      output: "Could not determine Cloudflare account ID",
    };
  }

  const turnstileRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets`,
    {
      method: "POST",
      headers: cfHeaders,
      body: JSON.stringify({
        name: `${domain} Contact Form`,
        domains: [domain, `dev.${domain}`, `gerald.${domain}`],
        mode: "managed",
        bot_fight_mode: false,
      }),
    },
  );

  const turnstileData = await turnstileRes.json();

  if (!turnstileData.success) {
    return {
      ok: false,
      output: `Turnstile creation failed: ${JSON.stringify(turnstileData.errors)}`,
    };
  }

  return {
    ok: true,
    siteKey: turnstileData.result.sitekey,
    secretKey: turnstileData.result.secret,
    output: `Turnstile widget created: ${turnstileData.result.sitekey}`,
  };
}
