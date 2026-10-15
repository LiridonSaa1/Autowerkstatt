# Gallery photo uploads

Gallery creation opens a modal with a local photo picker and preview. The image is uploaded first; the returned path is saved on the portfolio entry. Failed portfolio creation retains the uploaded path for a retry while the modal remains open.

`POST /api/admin/portfolio-image` requires administrator authorization. It accepts a raw JPEG, PNG or WebP body (maximum 8 MB), validates its signature, and generates a random filename. `GET /api/portfolio-images/:filename` serves published photos with `nosniff`.

Photos are stored in `PORTFOLIO_UPLOAD_DIR`, default `.local/portfolio-uploads` relative to the API working directory. Keep this directory on a persistent volume when deploying. Local storage targets one server instance; shared deployments need shared storage. Removing a gallery entry does not remove its photo file.

Run `node --test tests/portfolio-images.test.mjs` from this directory to check authorization, file type validation, size limits and saved image retrieval with isolated fixtures.
