.PHONY: install lint lint-fix test dev docker-build up down

install:
	npm install

lint:
	npm run lint

lint-fix:
	npm run lint:fix

test:
	npm test

dev:
	npm run dev

docker-build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down
