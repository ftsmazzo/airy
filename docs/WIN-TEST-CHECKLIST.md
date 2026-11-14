# Checklist de aceite — Windows (Onda 1)

Instalador: `release/Airy-Setup-0.1.0-x64.exe`  
Provisionador: `https://airy-provisioner.kxryyk.easypanel.host`

## Instalação

- [ ] Rodar o `.exe` (NSIS) sem Node/npm no PATH
- [ ] Atalho / ícone abre a Airy
- [ ] Sem terminal, sem `npm run dev`

## Token e Start

- [ ] Primeiro boot pede token de instalação
- [ ] Token válido → Ativar → orbe pronto
- [ ] Token errado / curto → mensagem clara, sem liberar voz
- [ ] Sem token → recursos bloqueados

## Voz e orbe

- [ ] Espaço (PTT) escuta e responde
- [ ] Orbe muda de estado (idle → listening → thinking → speaking)
- [ ] Preview de voz em Ajustes funciona
- [ ] Nome da IA / como te chama grava e usa

## Pacotes e Radar

- [ ] “Abre o ChatGPT / Notion / YouTube” abre com pacote ligado
- [ ] Pacote desligado → fala “desligado nos Pacotes”
- [ ] Radar com URL em Ajustes abre a URL certa
- [ ] Preferência “app/PWA” tenta o app; senão cai no browser

## MCP (ie-dados)

- [ ] Boot com MCP ok: Ajustes mostra “MCP ok · N tools”
- [ ] MCP fora / token ruim: voz continua; aviso de dados públicos
- [ ] Pedido de CABS / votos responde ou explica falha (sem inventar)

## Pasta vigiada

- [ ] Escolher pasta em Ajustes
- [ ] Arquivo novo gera aviso (se ligado)

## Regressão rápida

- [ ] Religar o app mantém config (cofre DPAPI)
- [ ] `,` abre Ajustes
- [ ] Doctor (dev): `npm run doctor` verde com cofre ou `.env`
