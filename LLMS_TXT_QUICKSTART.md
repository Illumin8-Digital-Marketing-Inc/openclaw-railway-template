# llms.txt Quick Reference

## What Was Added

✅ **`/llms.txt`** - Concise overview (~30 lines)  
✅ **`/llms-full.txt`** - Extended documentation (~200 lines)  
✅ **Production only** - NOT served on dev subdomain  
✅ **Dynamic routes** - No build step required  

## Testing URLs (once deployed)

```bash
# Production (should work):
https://cassandkathryn.com/llms.txt
https://cassandkathryn.com/llms-full.txt

# Dev (should NOT have llms.txt):
https://dev.cassandkathryn.com/llms.txt
```

## Quick Test

```bash
# Test llms.txt
curl https://cassandkathryn.com/llms.txt

# Should return:
# Cass & Kathryn Morrow - Marriage Coaching
#
# > Marriage coaching for men and women in crisis...
```

## Code Location

**File:** `src/server.js`  
**Lines:** ~4147-4358 (in production routing section)  
**Commits:**  
- `08105c9` - Main implementation
- `78c6edc` - Documentation

## Next Steps

1. **Merge to Railway** - This is already in the `main` branch of `gerald-railway-template`
2. **Deploy** - Railway will auto-deploy when you trigger a rebuild
3. **Test** - Verify URLs above return content
4. **Optional:** Submit to llms.txt directories:
   - https://llmstxt.site/
   - https://directory.llmstxt.cloud/

## LLM Testing

Try asking Claude or ChatGPT:

> "Can you fetch and summarize https://cassandkathryn.com/llms.txt?"

It should be able to read and understand the marriage coaching business.

---

**Full documentation:** `LLMS_TXT_IMPLEMENTATION.md`
