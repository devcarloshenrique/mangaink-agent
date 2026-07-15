# remove-filesystem-backend

Remove o backend de persistência em filesystem (JSON em `storage/`), consolidando Postgres como único storage de metadados/estado via Prisma. Elimina a flag `REPO_BACKEND`, os adapters `Filesystem*`, o método `withConversion()` de scoping por path-prefix e o cache de placeholders em `images.json`.
