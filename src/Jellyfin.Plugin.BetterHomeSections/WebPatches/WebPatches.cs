using Jellyfin.Plugin.BetterHomeSections.Helpers;
using Newtonsoft.Json;

namespace Jellyfin.Plugin.BetterHomeSections.WebPatches;

/// <summary>
/// The content of a web file sent by the File Transformation plugin.
/// </summary>
public class PatchRequestPayload
{
    /// <summary>
    /// Gets or sets the content of the file.
    /// </summary>
    [JsonProperty("contents")]
    public string? Contents { get; set; }
}

/// <summary>
/// The changes made to the Jellyfin web client files, called by the File Transformation plugin.
/// </summary>
public static class WebPatches
{
    /// <summary>
    /// Text identifying the web client file that renders the home sections.
    /// </summary>
    public const string HomeSectionsMarker = ",loadSections:";

    /// <summary>
    /// Adds the plugin script and stylesheet to the web client.
    /// </summary>
    /// <param name="payload">The content of <c>index.html</c>.</param>
    /// <returns>The patched content.</returns>
    public static string PatchIndexHtml(PatchRequestPayload payload)
    {
        string contents = payload.Contents ?? string.Empty;
        string version = Uri.EscapeDataString(WebFiles.GetVersionTag());

        // Relative to /web/, so it works whatever the base URL of the server
        string tags = $"<link rel=\"stylesheet\" href=\"../BetterHomeSections/Web/betterHomeSections.css?v={version}\" />"
            + $"<script defer src=\"../BetterHomeSections/Web/betterHomeSections.js?v={version}\"></script>";

        return contents.Replace("</head>", tags + "</head>", StringComparison.Ordinal);
    }

    /// <summary>
    /// Makes the <c>loadSections</c> function of the home screen call the plugin, which falls back to the original function if needed.
    /// </summary>
    /// <remarks>
    /// The function is an entry of the object exported by the home sections module, like <c>{getDefaultSection:N,loadSections:function(e,t,r,a){...},...}</c>.
    /// The original function is kept in a new <c>originalLoadSections</c> entry, and the web client calls it as a method of this object.
    /// </remarks>
    /// <param name="payload">The content of the web client file defining <c>loadSections</c>.</param>
    /// <returns>The patched content.</returns>
    public static string PatchHomeSections(PatchRequestPayload payload)
    {
        return (payload.Contents ?? string.Empty).Replace(
            HomeSectionsMarker,
            ",loadSections:function(){var b=window.BetterHomeSections,o=this.originalLoadSections;"
            + "return b?b.loadSections(o,arguments):o.apply(this,arguments)},originalLoadSections:",
            StringComparison.Ordinal);
    }
}
