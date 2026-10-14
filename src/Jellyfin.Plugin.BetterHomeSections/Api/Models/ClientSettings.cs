using Jellyfin.Plugin.BetterHomeSections.Configuration;

namespace Jellyfin.Plugin.BetterHomeSections.Api.Models;

/// <summary>
/// The settings sent to the web client to render the home screen.
/// </summary>
public class ClientSettings
{
    /// <summary>
    /// Gets or sets a string that changes whenever the web files change, to bypass browser caches.
    /// </summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the language chosen by the administrator, empty to use the language of the Jellyfin interface.
    /// </summary>
    public string Language { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the languages the plugin is translated into.
    /// </summary>
    public IReadOnlyList<LanguageInfo> Languages { get; set; } = [];

    /// <summary>
    /// Gets or sets the visible sections, in order.
    /// </summary>
    public IReadOnlyList<ClientSection> Sections { get; set; } = [];

    /// <summary>
    /// Gets or sets the identifiers of the genres hidden from the sections.
    /// </summary>
    public IReadOnlyList<string> ExcludedGenres { get; set; } = [];

    /// <summary>
    /// Gets or sets the color and media chosen for the pictures of some genres.
    /// </summary>
    public IReadOnlyList<GenreConfiguration> Genres { get; set; } = [];

    /// <summary>
    /// Gets or sets the identifiers of the studios / networks hidden from the sections.
    /// </summary>
    public IReadOnlyList<string> ExcludedStudios { get; set; } = [];
}

/// <summary>
/// A language the plugin is translated into.
/// </summary>
public class LanguageInfo
{
    /// <summary>
    /// Gets or sets the language code, like <c>en</c> or <c>fr</c>.
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the name of the language in that language.
    /// </summary>
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// A section with the names of the items it references.
/// </summary>
public class ClientSection
{
    /// <summary>
    /// Gets or sets the unique identifier of the section.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the type of the section.
    /// </summary>
    public SectionType Type { get; set; }

    /// <summary>
    /// Gets or sets how the items are displayed.
    /// </summary>
    public SectionViewMode ViewMode { get; set; }

    /// <summary>
    /// Gets or sets how the items are ordered.
    /// </summary>
    public SectionOrder Order { get; set; }

    /// <summary>
    /// Gets or sets the number of items displayed, 0 for the default of the section type.
    /// </summary>
    public int Limit { get; set; }

    /// <summary>
    /// Gets or sets the custom title, empty to use the generated one.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the library the section is limited to, <c>null</c> for all libraries.
    /// </summary>
    public ClientItem? Library { get; set; }

    /// <summary>
    /// Gets or sets the genre, studio or collection the section is about, if any.
    /// </summary>
    public ClientItem? Item { get; set; }
}

/// <summary>
/// A library, genre, studio or collection referenced by a section.
/// </summary>
public class ClientItem
{
    /// <summary>
    /// Gets or sets the identifier of the item.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the name of the item.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the collection type of the library (like <c>movies</c> or <c>tvshows</c>), if the item is a library.
    /// </summary>
    public string? CollectionType { get; set; }
}
