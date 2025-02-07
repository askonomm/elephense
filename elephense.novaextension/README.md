Adds the [Intelephense](https://intelephense.com/) advanced language server (LSP) for PHP.

## Requirements

Elephense requires [Node.js](https://nodejs.org) and [intelephense](https://www.npmjs.com/package/intelephense) to be installed. If you want Elephense to be able to automatically detect Intelephense, make sure to install it globally (e.g `npm i -g intelephense`).

## Usage

Once the extension is activated it will attempt to find if you have the Intelephense LSP already installed in your system, and if you do, it will automatically use that. If you do not or it can't find it then make sure to add the path to it in the extension settings.

Elephense will default to PHP 8.4, but you can change that preference on a global or per project basis.

### To activate a premium license

-   Go to **Extensions → Elephense → Enter license key**.
-   Type your license key in the notification box that appears in the top-right corner.
-   Click submit.

If the activation is successful you'll see a notice informing you of the success and Elephense will be restarted.

### Workspace specific stubs

You can configure stubs that Intelephense will use on a per-project basis by going to **Project → Project Settings → Elephense** and changing the stubs list there. If you set this list of stubs back to the default value Elephense will instead use the stubs list from the global preferences. To quickly reset the stubs list back to default values you can go to **Extensions → Intelephense → Reset Workspace Stubs**.

### Configuration

To configure global preferences, go to **Extensions → Extension Library...** and select Elephense's **Preferences** tab.

You can also configure preferences on a per-project basis in **Project → Project Settings...**
