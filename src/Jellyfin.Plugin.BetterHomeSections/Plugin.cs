using Jellyfin.Plugin.BetterHomeSections.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.BetterHomeSections;

/// <summary>
/// The Better Home Sections plugin.
/// </summary>
public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    /// <summary>
    /// The GitHub repository of the plugin, used to load the web files of a specific commit.
    /// </summary>
    public const string Repository = "angeluriot/jellyfin-plugin-better-home-sections";

    /// <summary>
    /// Initializes a new instance of the <see cref="Plugin"/> class.
    /// </summary>
    /// <param name="applicationPaths">Instance of the <see cref="IApplicationPaths"/> interface.</param>
    /// <param name="xmlSerializer">Instance of the <see cref="IXmlSerializer"/> interface.</param>
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    /// <summary>
    /// Gets the current plugin instance.
    /// </summary>
    public static Plugin? Instance { get; private set; }

    /// <inheritdoc />
    public override string Name => "Better Home Sections";

    /// <inheritdoc />
    public override Guid Id => Guid.Parse("80baa139-52ad-44e9-8d33-a45544c4a962");

    /// <inheritdoc />
    public override string Description => "Replaces the home screen sections with sections configured by the administrator.";

    /// <inheritdoc />
    public IEnumerable<PluginPageInfo> GetPages()
    {
        string prefix = GetType().Namespace + ".Configuration.";

        return
        [
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = prefix + "configPage.html",
                EnableInMainMenu = true,
                MenuIcon = "home"
            },
            new PluginPageInfo
            {
                Name = "BetterHomeSectionsConfigController",
                EmbeddedResourcePath = prefix + "configController.js"
            }
        ];
    }
}
