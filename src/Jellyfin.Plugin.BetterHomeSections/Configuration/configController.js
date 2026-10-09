/**
 * Controller of the configuration page: loads the plugin script if the web client does not include it
 * (File Transformation missing), then the page script, which may come from the configured test commit.
 */
function loadScript(url) {
    return new Promise(function (resolve, reject) {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

export default function (view) {
    const apiClient = window.ApiClient;
    const isScriptMissing = !window.BetterHomeSections;

    Dashboard.showLoadingMsg();

    (isScriptMissing ? loadScript(apiClient.getUrl('BetterHomeSections/Web/betterHomeSections.js')) : Promise.resolve())
        .then(function () {
            return window.BetterHomeSections.getSettings(apiClient);
        })
        .then(function (settings) {
            return import(apiClient.getUrl('BetterHomeSections/Web/configPage.js', { v: settings.Version })).then(function (page) {
                return page.init(view, settings, { isScriptMissing: isScriptMissing });
            });
        })
        .catch(function (error) {
            console.error('[BetterHomeSections] Failed to load the configuration page', error);
        })
        .then(function () {
            Dashboard.hideLoadingMsg();
        });
}
