include .env

MAKEFLAGS += --no-print-directory

COMPOSE := docker compose -f docker-compose.${APP_ENV}.yml
CONTAINER_NAME := cross-poker-front

f :=
art:
	@cat configs/scripts/arts/${f}.txt
	@echo

echo-system:
	@make art f=system

build:
	@$(COMPOSE) build --no-cache

build-cache:
	@$(COMPOSE) build

# Só no local (bind mount): em homolog/produção as dependências já vêm instaladas na imagem (Dockerfile.deploy).
install-deps:
ifeq ($(APP_ENV),local)
	@$(COMPOSE) run --rm --no-deps $(CONTAINER_NAME) npm install
else
	@echo "APP_ENV=$(APP_ENV): dependências já instaladas na imagem, nada a fazer."
endif

logs:
	@docker logs -f $(CONTAINER_NAME)

watch:
	@$(COMPOSE) up

clear-up:
	@$(COMPOSE) up -d

up:
	@make clear-up
	@make echo-system

down:
	@$(COMPOSE) down

restart:
	@make down
	@make up

phoenix:
	@make down
	@make build-cache
	@make up

# Rebuild e troca só o container do app, sem derrubar o Postgres.
update-build:
	@$(COMPOSE) build $(CONTAINER_NAME)
	@$(COMPOSE) up -d --no-deps $(CONTAINER_NAME)

c :=
exec:
	@$(COMPOSE) exec $(CONTAINER_NAME) $(c)

shell:
	@$(COMPOSE) exec -it $(CONTAINER_NAME) /bin/sh

b ?=
npm-install:
	@make exec c="npm install $(b)"

lint:
	@make exec c="npm run lint"

# Em homolog/produção as migrações já rodam sozinhas na subida do container.
db-migrate:
	@make exec c="node db/migrate.mjs"

s :=
t :=
m :=
step:
	@echo
	@echo "█▓▒░ \033[38;2;255;196;12m[$(s)/$(t)]\033[0m $(m)"
	@echo

install:
	@make echo-system
	@make step s=1 t=4 m="Building the Docker image..."
	@make build
	@make step s=2 t=4 m="Installing dependencies (npm install)..."
	@make install-deps
	@make step s=3 t=4 m="Starting the containers..."
	@make clear-up
	@make step s=4 t=4 m="Running database migrations..."
	@make db-migrate
	@echo
	@echo "░▒▓█ \033[38;2;22;198;12mCross Poker\033[0m installed!"
	@echo
