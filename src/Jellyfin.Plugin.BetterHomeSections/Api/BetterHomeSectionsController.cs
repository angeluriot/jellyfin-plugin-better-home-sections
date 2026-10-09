using System.Net.Mime;
using Jellyfin.Plugin.BetterHomeSections.Api.Models;
using Jellyfin.Plugin.BetterHomeSections.Configuration;
using Jellyfin.Plugin.BetterHomeSections.Helpers;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace Jellyfin.Plugin.BetterHomeSections.Api;

/// <summary>
/// Endpoints used by the web client to render the home screen.
/// </summary>
[ApiController]
[Route("BetterHomeSections")]
public class BetterHomeSectionsController : ControllerBase
{
    private static readonly FileExtensionContentTypeProvider _contentTypes = new();

    private readonly ILibraryManager _libraryManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="BetterHomeSectionsController"/> class.
    /// </summary>
    /// <param name="libraryManager">Instance of the <see cref="ILibraryManager"/> interface.</param>
    public BetterHomeSectionsController(ILibraryManager libraryManager)
    {
        _libraryManager = libraryManager;
    }

    /// <summary>
    /// Gets a web file (script, style or translation) of the plugin.
    /// </summary>
    /// <param name="path">The path of the file relative to the web folder.</param>
    /// <response code="200">The file.</response>
    /// <response code="302">Redirection to the file of the configured commit.</response>
    /// <response code="404">The file does not exist.</response>
    /// <returns>The file content.</returns>
    [HttpGet("Web/{**path}")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status302Found)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult GetWebFile([FromRoute] string path)
    {
        if (!WebFiles.IsValidPath(path))
        {
            return NotFound();
        }

        string? commitUrl = WebFiles.GetCommitUrl(path);
        if (commitUrl is not null)
        {
            return Redirect(commitUrl);
        }

        Stream? stream = WebFiles.Open(path);
        if (stream is null)
        {
            return NotFound();
        }

        // Versioned URLs never change, the others must be revalidated
        Response.Headers.CacheControl = Request.Query.ContainsKey("v") ? "public, max-age=31536000, immutable" : "no-cache";

        string contentType = _contentTypes.TryGetContentType(path, out string? type) ? type : MediaTypeNames.Application.Octet;
        return File(stream, contentType);
    }

    /// <summary>
    /// Gets the settings needed to render the home screen.
    /// </summary>
    /// <response code="200">The settings.</response>
    /// <returns>The language settings and the visible sections.</returns>
    [HttpGet("Settings")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<ClientSettings> GetSettings()
    {
        PluginConfiguration configuration = Plugin.Instance?.Configuration ?? new PluginConfiguration();

        return new ClientSettings
        {
            Version = WebFiles.GetVersionTag(),
            Language = configuration.Language,
            Languages = WebFiles.Languages,
            Sections = configuration.Sections
                .Where(section => section.Visible)
                .Select(ToClientSection)
                .OfType<ClientSection>()
                .ToArray()
        };
    }

    private static bool UsesItem(SectionType type) => type is SectionType.Genre or SectionType.Studio or SectionType.Collection;

    private static bool UsesLibrary(SectionType type) => type is SectionType.RecentlyAdded
        or SectionType.Genres or SectionType.Genre or SectionType.Studios or SectionType.Studio;

    /// <summary>
    /// Resolves the names of the items referenced by a section.
    /// </summary>
    /// <returns>The section, or <c>null</c> if a referenced item does not exist anymore.</returns>
    private ClientSection? ToClientSection(SectionConfiguration section)
    {
        ClientSection result = new()
        {
            Id = section.Id,
            Type = section.Type,
            ViewMode = section.ViewMode,
            Order = section.Order,
            Title = section.Title.Trim()
        };

        if (UsesLibrary(section.Type) && !string.IsNullOrEmpty(section.LibraryId))
        {
            if (FindItem(section.LibraryId) is not CollectionFolder library)
            {
                return null;
            }

            result.Library = new ClientItem
            {
                Id = section.LibraryId,
                Name = library.Name,
                CollectionType = library.CollectionType?.ToString()
            };
        }

        if (UsesItem(section.Type))
        {
            BaseItem? item = FindItem(section.ItemId);
            if (item is null)
            {
                return null;
            }

            result.Item = new ClientItem { Id = section.ItemId, Name = item.Name };
        }

        return result;
    }

    private BaseItem? FindItem(string id) => Guid.TryParse(id, out Guid guid) ? _libraryManager.GetItemById(guid) : null;
}
