# Vehicle-aware review cards

Review cards request `/api/reviews/:id/vehicle`. Only approved review IDs can be resolved. The server uses the vehicle-name field only; reviewer names, comments and contact information are not sent to the identification provider.

When `OPENAI_API_KEY` is configured on the server, the Responses API normalizes make/model/year using structured output (`OPENAI_VEHICLE_MODEL`, default `gpt-4.1-mini`). Missing keys, provider errors, refusals and low-confidence results fall back to known name aliases. An explicitly recognized make is not replaced with a different make by AI.

Wikimedia Commons supplies example images when the filename matches both make and model and reusable license metadata is available. Attribution and license links are displayed with the image. Images are examples of the model family; trim, exact generation, color and year are not guaranteed. If no match can be verified or the source fails, a neutral car icon is used instead of a different vehicle.

Identification and lookup results are deduplicated and cached in the API process (24 hours for images, 5 minutes for missing images), with a maximum of 4 concurrent resolutions and 500 cached entries. Restarting the server clears this cache.

Test: `node --test tests/vehicle-identity.test.mjs` (mocked providers, no billable API calls).

References:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://www.mediawiki.org/wiki/API:Imageinfo
