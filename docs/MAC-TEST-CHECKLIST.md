# Checklist de aceite — Mac (Onda 1)

Enquanto o DMG não estiver assinado: build local (`npm run dist:mac` em macOS) ou `npm run dev` após `./scripts/setup-mac.sh`.  
Provisionador: `https://airy-provisioner.kxryyk.easypanel.host`

## Instalação

- [ ] App abre pelo ícone / atalho (sem depender de terminal no uso diário)
- [ ] (Dev) `./scripts/setup-mac.sh` + doctor verde

## Token e Start

- [ ] Primeiro boot pede token de instalação
- [ ] Token válido → Ativar → orbe pronto
- [ ] Token errado → mensagem clara
- [ ] Sem token → recursos bloqueados

## Voz e orbe

- [ ] Espaço (PTT) escuta e responde
- [ ] Orbe muda de estado
- [ ] 2 palmas (opcional se mic ok)
- [ ] “Airy …” wake (se ligado)
- [ ] Preview de voz em Ajustes

## Pacotes e Radar

- [ ] Sites da lista Ary abrem com pacote ligado
- [ ] Pacote desligado → “desligado nos Pacotes”
- [ ] Radar usa URL da config
- [ ] Preferência app vs browser do Radar

## MCP (ie-dados)

- [ ] Ajustes mostra status MCP
- [ ] CABS / votos: responde ou explica falha
- [ ] MCP offline não trava a voz

## Pasta vigiada

- [ ] Pasta escolhida; arquivo novo avisa

## Regressão

- [ ] Config persiste no Keychain/cofre
- [ ] `,` abre Ajustes
