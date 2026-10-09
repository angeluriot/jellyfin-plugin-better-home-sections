using System.Reflection;
using System.Runtime.Loader;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Model.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Jellyfin.Plugin.BetterHomeSections.WebPatches;

/// <summary>
/// Registers the <see cref="WebPatches"/> to the File Transformation plugin when the server starts.
/// </summary>
public class RegisterWebPatchesTask : IScheduledTask, IConfigurableScheduledTask
{
    private static readonly Guid _indexHtmlPatchId = Guid.Parse("038d8d89-e6e3-4227-acdf-a114440a80ba");

    private readonly IApplicationPaths _applicationPaths;
    private readonly ILogger<RegisterWebPatchesTask> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="RegisterWebPatchesTask"/> class.
    /// </summary>
    /// <param name="applicationPaths">Instance of the <see cref="IApplicationPaths"/> interface.</param>
    /// <param name="logger">Instance of the <see cref="ILogger{RegisterWebPatchesTask}"/> interface.</param>
    public RegisterWebPatchesTask(IApplicationPaths applicationPaths, ILogger<RegisterWebPatchesTask> logger)
    {
        _applicationPaths = applicationPaths;
        _logger = logger;
    }

    /// <inheritdoc />
    public string Name => "Better Home Sections startup";

    /// <inheritdoc />
    public string Key => "BetterHomeSectionsStartup";

    /// <inheritdoc />
    public string Description => "Registers the changes made to the web client by Better Home Sections.";

    /// <inheritdoc />
    public string Category => "Better Home Sections";

    /// <inheritdoc />
    public bool IsHidden => true;

    /// <inheritdoc />
    public bool IsEnabled => true;

    /// <inheritdoc />
    public bool IsLogged => false;

    /// <inheritdoc />
    public IEnumerable<TaskTriggerInfo> GetDefaultTriggers()
    {
        yield return new TaskTriggerInfo { Type = TaskTriggerInfoType.StartupTrigger };
    }

    /// <inheritdoc />
    public Task ExecuteAsync(IProgress<double> progress, CancellationToken cancellationToken)
    {
        MethodInfo? registerTransformation = AssemblyLoadContext.All
            .SelectMany(context => context.Assemblies)
            .FirstOrDefault(assembly => assembly.GetName().Name == "Jellyfin.Plugin.FileTransformation")?
            .GetType("Jellyfin.Plugin.FileTransformation.PluginInterface")?
            .GetMethod("RegisterTransformation");

        if (registerTransformation is null)
        {
            _logger.LogError("The File Transformation plugin is not installed, Better Home Sections cannot replace the home sections");
            return Task.CompletedTask;
        }

        registerTransformation.Invoke(null, [CreatePayload(_indexHtmlPatchId, "index.html", nameof(WebPatches.PatchIndexHtml))]);

        // The home sections are in one of the lazy-loaded chunks at the root of the web client
        string[] homeSectionsFiles = Directory
            .EnumerateFiles(_applicationPaths.WebPath, "*.chunk.js", SearchOption.TopDirectoryOnly)
            .Where(file => File.ReadAllText(file).Contains(WebPatches.HomeSectionsMarker, StringComparison.Ordinal))
            .Select(file => Path.GetRelativePath(_applicationPaths.WebPath, file).Replace('\\', '/'))
            .ToArray();

        if (homeSectionsFiles.Length == 0)
        {
            _logger.LogError("The home sections script was not found in the web client, Better Home Sections cannot replace the home sections");
        }

        foreach (string file in homeSectionsFiles)
        {
            _logger.LogInformation("Patching the home sections of the web client in {File}", file);
            registerTransformation.Invoke(null, [CreatePayload(GetPatchId(file), Regex.Escape(file), nameof(WebPatches.PatchHomeSections))]);
        }

        return Task.CompletedTask;
    }

    // Stable identifier per file, so registering again replaces the previous transformation
    private static Guid GetPatchId(string file) => new(SHA256.HashData(Encoding.UTF8.GetBytes("BetterHomeSections:" + file)).AsSpan(0, 16));

    private static JObject CreatePayload(Guid id, string fileNamePattern, string callbackMethod) => new()
    {
        { "id", id.ToString() },
        { "fileNamePattern", fileNamePattern },
        { "callbackAssembly", typeof(WebPatches).Assembly.FullName },
        { "callbackClass", typeof(WebPatches).FullName },
        { "callbackMethod", callbackMethod }
    };
}
