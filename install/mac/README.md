# Airy — instalação macOS

## Usuário final (DMG)

1. Abra `Airy-*-arm64.dmg` ou `x64` (pasta `release/` após o build).
2. Arraste **Airy** para Aplicativos → abra.
3. Token de instalação → microfone → falar.

> Sem notarização Apple ainda: pode pedir “Abrir mesmo assim” em Privacidade e Segurança.

## Gerar o DMG (só em Mac)

```bash
cd /caminho/para/airy
chmod +x install/mac/build.sh
./install/mac/build.sh
# ou: npm run dist:mac
```

## Setup legado (repo + npm — só desenvolvimento)

```bash
chmod +x install/mac/setup.sh
./install/mac/setup.sh
```
