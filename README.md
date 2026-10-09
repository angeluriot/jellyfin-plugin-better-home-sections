# Better Home Sections

A **Jellyfin** plugin that replaces the home screen sections with sections configured by the administrator.

* The sections are the same for every user and can only be changed by the administrator
* Sections and genres / studios without content are hidden automatically
* Cards are rendered by the Jellyfin web client itself, so themes (like **[ElegantFin](https://github.com/mihaif7/elegantfin-jf12)**) and other plugins (like **[Jellyfin Enhanced](https://github.com/n00bcodr/Jellyfin-Enhanced)** or **[Media Bar](https://github.com/IAmParadox27/jellyfin-plugin-media-bar)**) keep working
* Translated in English and French (the language of the Jellyfin interface is used by default)

## Requirements

* **Jellyfin** `12.1`
* **[File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation)**, used to load the plugin in the web client
* Uninstall **[Home Screen Sections](https://github.com/IAmParadox27/jellyfin-plugin-home-sections)** if you have it, both plugins replace the same sections

## Installation

1. In **Dashboard > Plugins > Repositories**, add this repository:
   ```
   https://raw.githubusercontent.com/angeluriot/jellyfin-plugin-better-home-sections/main/manifest.json
   ```
2. Install **Better Home Sections** from the catalog
3. Restart the server

## Configuration

Open **Dashboard > Plugins > Better Home Sections** (also in the dashboard menu).

* **Language**: the language of the section titles, the language of the Jellyfin interface by default
* **Commit hash**: see [Testing changes](#testing-changes), leave empty otherwise
* **Sections**: add, edit, hide, reorder and remove the sections displayed on the home screen, in order

Each section has a view mode (portrait or landscape), an order, a visibility toggle and an optional custom title. Depending on its type, it can also be limited to a library (or all of them), and be about a genre, a studio / network or a collection.

| Section | Content | Orders | Title links to |
| --- | --- | --- | --- |
| Continue Watching | Same as Jellyfin | Jellyfin default | - |
| Next Up | Same as Jellyfin | Jellyfin default | Next up list |
| Recently added | Latest items of a library | Last added first | The library |
| Genres | Genres of a library, illustrated with a random item like in Seerr | Most items first, Random | The genres of the library |
| Genre | Items of a library with a genre | Last added first, Random | The genre in the library |
| Studios / networks | Studios / networks of a library, with their logo | Most items first, Random | The studios / networks of the library |
| Studio / network | Items of a library from a studio / network | Last added first, Random | The studio in the library |
| Collections | The collections | Most items first, Last added first, Random | The collections |
| Collection | Items of a collection | Last added first, Random | The collection |
| Favorites | Favorites of the user | Jellyfin default | The favorites |

The changes apply when the home screen is loaded again (refresh the page).

## How it works

* At startup, the plugin asks **File Transformation** to add its script and stylesheet to the web client, and to make the `loadSections` function of the home screen call the plugin script instead (the original function is used as fallback if anything fails)
* The script gets the sections from `/BetterHomeSections/Settings`, then renders them with the native section markup and card builder, using the Jellyfin API for the content

## Testing changes

To test changes to the web files (`src/Jellyfin.Plugin.BetterHomeSections/Web`) on a real server without installing a new version, push them to GitHub and enter the commit hash in the settings: the home screen script, its stylesheet, the translations and the settings page script are then loaded from this commit through [jsDelivr](https://www.jsdelivr.com/). Changes to the C# code still require a new build.

## Adding a language

Copy `src/Jellyfin.Plugin.BetterHomeSections/Web/Localization/en.json` to `<code>.json` (like `de.json` or `pt-BR.json`) and translate it, `LanguageName` being the name of the language in that language. Missing strings fall back to English.

## Development

Build with the [.NET 10 SDK](https://dotnet.microsoft.com/download):

```
dotnet build src/Jellyfin.Plugin.BetterHomeSections -c Release
```

Then copy `Jellyfin.Plugin.BetterHomeSections.dll` from `bin/Release/net10.0` to a folder in the `plugins` folder of your server and restart it.

To publish a version, run the **Release** workflow from the GitHub Actions tab with a version number and a changelog: it builds the plugin, creates the GitHub release and adds the version to `manifest.json`.
