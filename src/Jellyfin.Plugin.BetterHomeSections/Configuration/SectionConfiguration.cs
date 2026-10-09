namespace Jellyfin.Plugin.BetterHomeSections.Configuration;

/// <summary>
/// The kinds of sections that can be displayed on the home screen.
/// </summary>
public enum SectionType
{
    /// <summary>Items the user started watching.</summary>
    ContinueWatching,

    /// <summary>Most recently added items of a library (or all of them).</summary>
    RecentlyAdded,

    /// <summary>Illustrated tiles of the genres of a library (or all of them).</summary>
    Genres,

    /// <summary>Items of a library (or all of them) matching a genre.</summary>
    Genre,

    /// <summary>Tiles of the studios / networks of a library (or all of them).</summary>
    Studios,

    /// <summary>Items of a library (or all of them) matching a studio / network.</summary>
    Studio,

    /// <summary>The collections of the server.</summary>
    Collections,

    /// <summary>Items of a collection.</summary>
    Collection,

    /// <summary>Items marked as favorites by the user.</summary>
    Favorites,

    /// <summary>Next episodes to watch.</summary>
    NextUp
}

/// <summary>
/// How the items of a section are displayed.
/// </summary>
public enum SectionViewMode
{
    /// <summary>Portrait cards (posters).</summary>
    Portrait,

    /// <summary>Landscape cards (thumbnails / backdrops).</summary>
    Landscape
}

/// <summary>
/// How the items of a section are ordered.
/// </summary>
public enum SectionOrder
{
    /// <summary>The same order as the equivalent Jellyfin section.</summary>
    Default,

    /// <summary>Most recently added items first.</summary>
    LastAdded,

    /// <summary>Entries containing the most items first.</summary>
    MostItems,

    /// <summary>Random order.</summary>
    Random
}

/// <summary>
/// The settings of a section configured by the administrator.
/// </summary>
public class SectionConfiguration
{
    /// <summary>
    /// Gets or sets the unique identifier of the section.
    /// </summary>
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    /// <summary>
    /// Gets or sets the type of the section.
    /// </summary>
    public SectionType Type { get; set; }

    /// <summary>
    /// Gets or sets the identifier of the library the section is limited to, empty for all libraries.
    /// </summary>
    public string LibraryId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the identifier of the genre, studio or collection the section is about.
    /// </summary>
    public string ItemId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets how the items are displayed.
    /// </summary>
    public SectionViewMode ViewMode { get; set; }

    /// <summary>
    /// Gets or sets how the items are ordered.
    /// </summary>
    public SectionOrder Order { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether the section is displayed on the home screen.
    /// </summary>
    public bool Visible { get; set; } = true;

    /// <summary>
    /// Gets or sets an optional title replacing the generated one.
    /// </summary>
    public string Title { get; set; } = string.Empty;
}
