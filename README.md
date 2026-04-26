# Jobb Sök

macOS-app för att söka svenska jobbannonser från flera källor samtidigt.

## Funktioner

- Söker parallellt mot **Arbetsförmedlingen**, **LinkedIn** och **JobbSafari**
- Filtrera på stad, sökord, max ålder på annonser och avstånd
- Markera jobb som **Sökt** eller **Ignorerad** — de försvinner från listan och sparas lokalt
- Exkludera jobb med specifika ord i titel/företag
- Visa/dölj sökt och ignorerade jobb via knappar i headern

## Installation

### "Jobb Sok is damaged and can't be opened"

macOS blockerar appar som inte är signerade med ett Apple Developer-certifikat. Kör följande kommando i terminalen för att kringgå detta:

```bash
xattr -cr /Applications/Jobb\ Sok.app
```

## Utveckling

```bash
npm install
npm run tauri dev
```

## Bygg

```bash
npm run tauri build
```

### Ny version + release

```bash
npm run new:version 1.2.3
```

Uppdaterar versionsnummer i alla filer, skapar en git-tagg och pushar. GitHub Actions bygger då automatiskt DMG (macOS) och EXE (Windows) och skapar en release.

## Stack

- [Tauri 2](https://tauri.app/) — native shell
- [Vue 3](https://vuejs.org/) + [Pinia](https://pinia.vuejs.org/) — UI och state
- Arbetsförmedlingens öppna [jobtechdev.se](https://jobtechdev.se/) API
