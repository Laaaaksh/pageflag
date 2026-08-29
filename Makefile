.PHONY: build dev test test-db lint format tidy clean

build:
	npm run build

dev:
	@echo "Run these in separate terminals: make dev-server, make dev-dashboard"

dev-server:
	npm run dev:server

dev-dashboard:
	npm run dev:dashboard

# Starts a throwaway Postgres container for the integration test suite. Safe to
# run repeatedly - it's a no-op once the container already exists.
test-db:
	@docker inspect pageflag-test-db >/dev/null 2>&1 || docker run -d --name pageflag-test-db \
		-p 55444:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pageflag_test \
		postgres:16-alpine >/dev/null
	@until docker exec pageflag-test-db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

test: test-db
	npm test

lint:
	npm run lint

format:
	npm run format

tidy: format

clean:
	docker rm -f pageflag-test-db >/dev/null 2>&1 || true
	rm -rf server/dist dashboard/dist packages/widget/dist
	rm -rf node_modules server/node_modules dashboard/node_modules packages/widget/node_modules
