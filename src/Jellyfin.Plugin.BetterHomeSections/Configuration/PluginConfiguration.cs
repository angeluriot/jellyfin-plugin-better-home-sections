using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.BetterHomeSections.Configuration;

/// <summary>
/// The configuration of the plugin.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// Gets or sets an optional commit of the GitHub repository to load the web files from, to test changes without rebuilding the plugin.
    /// </summary>
    public string CommitHash { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the language of the plugin, empty to use the language of the Jellyfin interface.
    /// </summary>
    public string Language { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the sections displayed on the home screen, in order.
    /// </summary>
    /// <remarks>An array (and not a list) so the XML serializer replaces the defaults instead of appending to them.</remarks>
    public SectionConfiguration[] Sections { get; set; } =
    [
        new() { Type = SectionType.ContinueWatching, ViewMode = SectionViewMode.Landscape },
        new() { Type = SectionType.NextUp, ViewMode = SectionViewMode.Landscape },
        new() { Type = SectionType.RecentlyAdded, ViewMode = SectionViewMode.Portrait, Order = SectionOrder.LastAdded }
    ];
}
