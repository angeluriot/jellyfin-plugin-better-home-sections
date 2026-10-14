namespace Jellyfin.Plugin.BetterHomeSections.Configuration;

/// <summary>
/// The color and media chosen for the picture of a genre, empty values meaning random.
/// </summary>
public class GenreConfiguration
{
    /// <summary>
    /// Gets or sets the identifier of the genre.
    /// </summary>
    public string GenreId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the name of the duotone colors of the picture (like <c>red</c> or <c>blue</c>), empty for random.
    /// </summary>
    public string Color { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the identifier of the movie or series illustrating the genre, empty for random.
    /// </summary>
    public string ItemId { get; set; } = string.Empty;
}
