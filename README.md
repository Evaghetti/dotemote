# Renderização de sprites com Typescript

## Configuração

Você vai precisar ter o typescript instalado na sua máquina

```bash
npm install -g typescript
```

Além disso para que funcione os emotes é necesário [criar uma aplicação no seu paínel de desenvolvedor](https://dev.twitch.tv/console/apps/create).
Feito isso copie o seu client id e o seu client secret e crie na raiz do projeto um arquivo chamado config.json com o seguinte conteúdo:

```json
{
  "client_id": "<SEU CLIENT ID>",
  "client_secret": "<SEU CLIENT SECRET>"
}
```

## Setup

Para rodar o codigo basta rodar o comando

```bash
  npx webpack --watch
```
