.PHONY: build dev test test-db lint format tidy clean demo

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

# Boots the real stack via docker compose, records a fresh README demo walkthrough
# against it with Playwright, and converts the result into docs/assets/demo.{mp4,gif}.
# See scripts/record-demo/README.md - including how to point this at `make dev-server`
# + `make dev-dashboard` instead, if the docker-compose build isn't working locally.
demo:
	docker compose up -d --build
	@echo "Waiting for the app on :4000..."
	@until curl -sf http://localhost:4000/api/health >/dev/null; do sleep 1; done
	cd scripts/record-demo && npm install && npx playwright install chromium && npm run record
	ffmpeg -y -i scripts/record-demo/output/demo.webm -vf "scale=1280:-2" \
		-c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 20 docs/assets/demo.mp4
	ffmpeg -y -i scripts/record-demo/output/demo.webm \
		-vf "fps=12,scale=960:-2:flags=lanczos,palettegen" /tmp/pageflag-demo-palette.png
	ffmpeg -y -i scripts/record-demo/output/demo.webm -i /tmp/pageflag-demo-palette.png \
		-filter_complex "fps=12,scale=960:-2:flags=lanczos[x];[x][1:v]paletteuse" docs/assets/demo.gif
	rm -f /tmp/pageflag-demo-palette.png
	@echo "Wrote docs/assets/demo.mp4 and docs/assets/demo.gif"
