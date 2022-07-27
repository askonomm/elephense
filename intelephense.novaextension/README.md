<!--
👋 Hello! As Nova users browse the extensions library, a good README can help them understand what your extension does, how it works, and what setup or configuration it may require.

Not every extension will need every item described below. Use your best judgement when deciding which parts to keep to provide the best experience for your new users.

💡 Quick Tip! As you edit this README template, you can preview your changes by selecting **Extensions → Activate Project as Extension**, opening the Extension Library, and selecting "Intelephense" in the sidebar.

Let's get started!
-->

<!--
🎈 Include a brief description of the features your extension provides. For example:
-->

**Intelephense** provides advanced language support for PHP via [Intelephense](https://intelephense.com/).

Intelephense is developed by [Ben Mewburn](https://github.com/bmewburn) on [GitHub](https://github.com/bmewburn/vscode-intelephense/). Ben Mewburn is not involved in the development of this extension.

The extension has mostly complete support for the configuration options available in Intelephense. If there's something you're missing please reach out and let me know.

![Screenshot showcasing Intelephense's ability to provide hover information.](https://git.sr.ht/~reykjalin/nova-intelephense/blob/main/Screenshots/demo.png)

<!--
🎈 It can also be helpful to include a screenshot or GIF showing your extension in action:
-->

## Requirements

<!--
🎈 If your extension depends on external processes or tools that users will need to have, it's helpful to list those and provide links to their installers:
-->

Intelephense requires some additional tools to be installed on your Mac:

- [Node.js](https://nodejs.org/en/)

<!--
✨ Providing tips, tricks, or other guides for installing or configuring external dependencies can go a long way toward helping your users have a good setup experience:
-->

> If you want to use a different version of Intelephense than the bundled version you can set a path to the executable in the extension preferences.

<!-- This comment is here to make sure these are separate notes -->

> Intelephense will occasionally fail to complete the necessary start-up routines and you won't get hover information, autocompletion, etc. When this happens please restart Intelephense using the provided command in **Extensions > Intelephense > Restart Intelephense**.

## Usage

<!--
🎈 If your extension provides features that are invoked manually, consider describing those options for users:
-->

To run Intelephense:

- Just activate the extension.

Once the extension is activated it will attempt to install Intelephense in the extension workspace, if no installation is found.

<!--
🎈 Alternatively, if your extension runs automatically (as in the case of a validator), consider showing users what they can expect to see:
-->

### Workspace specific stubs

You can configure stubs that Intelephense will use on a per-project basis by opening **Project → Project Settings → Intelephense** and changing the stubs list there.
If you set this list of stubs back to the default value Intelephense will instead use the stubs list from the global preferences.
To quickly reset the stubs list back to default values you can use the **Extensions → Intelephense → Reset Workspace Stubs** command.

### Configuration

<!--
🎈 If your extension offers global- or workspace-scoped preferences, consider pointing users toward those settings. For example:
-->

To configure global preferences, open **Extensions → Extension Library...** then select Intelephense's **Preferences** tab.

<!-- You can also configure preferences on a per-project basis in **Project → Project Settings...** -->

<!--
👋 That's it! Happy developing!

P.S. If you'd like, you can remove these comments before submitting your extension 😉
-->
