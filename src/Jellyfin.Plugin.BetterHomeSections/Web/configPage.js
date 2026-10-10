/**
 * Better Home Sections - configuration page.
 * Edits the plugin configuration (language, test commit and sections) with the built-in plugin configuration API.
 */

const PLUGIN_ID = '80baa139-52ad-44e9-8d33-a45544c4a962';

const VIEW_MODES = ['Portrait', 'Landscape'];

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function optionsHtml(options, selectedValue) {
    return options.map(function (option) {
        const selected = option.value === selectedValue ? ' selected' : '';
        return '<option value="' + escapeHtml(option.value) + '"' + selected + '>' + escapeHtml(option.label) + '</option>';
    }).join('');
}

function createId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), function (byte) {
        return byte.toString(16).padStart(2, '0');
    }).join('');
}

class ConfigPage {
    constructor(view, settings, config, libraries, collections, options) {
        this.bhs = window.BetterHomeSections;
        this.apiClient = window.ApiClient;
        this.root = view.querySelector('.bhsConfig');
        this.settings = settings;
        this.config = config;
        this.libraries = libraries;
        this.collections = collections;
        this.isScriptMissing = options.isScriptMissing;
        this.categoryCache = {};
        this.loadedCategories = {};
        this.editingId = null;
        this.t = null;

        this.root.addEventListener('click', this.onClick.bind(this));
        this.root.addEventListener('change', this.onChange.bind(this));
        this.root.addEventListener('submit', this.onSubmit.bind(this));
    }

    // ------------------------------------------------------------------ data

    loadTranslations() {
        const settings = Object.assign({}, this.settings, { Language: this.config.Language });
        return this.bhs.loadTranslator(this.apiClient, settings).then((t) => {
            this.t = t;
        });
    }

    getLibrary(id) {
        return this.libraries.find(function (library) {
            return library.Id === id;
        }) || null;
    }

    /** Genres or studios of a library (all libraries if the id is empty), cached. */
    loadCategories(kind, libraryId) {
        const key = kind + '|' + libraryId;
        if (!this.categoryCache[key]) {
            const library = this.getLibrary(libraryId);
            let path = kind === 'Studio' ? 'Studios' : 'Genres';
            if (kind === 'Genre' && this.bhs.isMusicLibrary(library)) {
                path = 'MusicGenres';
            }
            this.categoryCache[key] = this.apiClient.getJSON(this.apiClient.getUrl(path, {
                UserId: this.apiClient.getCurrentUserId(),
                ParentId: libraryId || undefined,
                IncludeItemTypes: this.bhs.getItemTypes(library),
                SortBy: 'SortName',
                EnableImages: false,
                EnableTotalRecordCount: false
            })).then((result) => {
                this.loadedCategories[key] = result.Items || [];
                return this.loadedCategories[key];
            }).catch(function (error) {
                console.error('[BetterHomeSections]', error);
                return [];
            });
        }
        return this.categoryCache[key];
    }

    /** Options of the item select of a section (genres, studios or collections). */
    getItemOptions(section) {
        const kind = this.bhs.sectionTypes[section.Type].item;
        if (kind === 'Collection') {
            return Promise.resolve(this.collections);
        }
        return this.loadCategories(kind, section.LibraryId);
    }

    /** Loads the items referenced by the sections, so their names can be displayed. */
    loadReferencedItems() {
        return Promise.all(this.config.Sections.filter((section) => {
            return this.bhs.sectionTypes[section.Type] && this.bhs.sectionTypes[section.Type].item;
        }).map((section) => this.getItemOptions(section)));
    }

    findItem(section) {
        const kind = this.bhs.sectionTypes[section.Type].item;
        const list = kind === 'Collection' ? this.collections : this.loadedCategories[kind + '|' + section.LibraryId];
        return (list || []).find(function (item) {
            return item.Id === section.ItemId;
        }) || null;
    }

    findSection(id) {
        return this.config.Sections.find(function (section) {
            return section.Id === id;
        });
    }

    // ------------------------------------------------------------- rendering

    getTitle(section) {
        const item = this.findItem(section);
        return this.bhs.getSectionTitle({
            Type: section.Type,
            Title: section.Title,
            Library: this.getLibrary(section.LibraryId),
            Item: item ? { Id: item.Id, Name: item.Name } : { Id: section.ItemId, Name: '…' }
        }, this.t);
    }

    render() {
        const t = this.t;
        const languageOptions = this.settings.Languages.map(function (language) {
            return { value: language.Code, label: language.Name };
        });
        const typeOptions = Object.keys(this.bhs.sectionTypes).map(function (type) {
            return { value: type, label: t('Type' + type) };
        });

        // The select of the new section has its label outside, so it is aligned with the button next to it
        this.root.innerHTML = '<style>.bhsAddRow .selectLabel{display:none}'
            + '.bhsAddRow .selectArrowContainer{top:0;bottom:0;display:flex;align-items:center}.bhsAddRow .selectArrow{margin:0}</style>'
            + '<form class="bhsForm">'
            + '<div class="verticalSection">'
            + '<div class="sectionTitleContainer flex align-items-center"><h2 class="sectionTitle">Better Home Sections</h2></div>'
            + (this.isScriptMissing ? '<p class="fieldDescription" style="color:#e57373">' + escapeHtml(t('ConfigMissingDependency')) + '</p>' : '')
            + '<h3>' + escapeHtml(t('ConfigGeneral')) + '</h3>'
            + '<div class="selectContainer"><select is="emby-select" data-field="Language" label="' + escapeHtml(t('ConfigLanguage')) + '">'
            + optionsHtml(languageOptions, this.config.Language) + '</select></div>'
            + '<div class="inputContainer"><input is="emby-input" type="text" data-field="CommitHash" maxlength="40" autocomplete="off" label="'
            + escapeHtml(t('ConfigCommitHash')) + '" value="' + escapeHtml(this.config.CommitHash) + '" />'
            + '<div class="fieldDescription">' + escapeHtml(t('ConfigCommitHashHelp')) + '</div></div>'
            + '</div>'
            + '<div class="verticalSection">'
            + '<h3>' + escapeHtml(t('ConfigSections')) + '</h3>'
            + '<p class="fieldDescription">' + escapeHtml(t('ConfigSectionsHelp')) + '</p>'
            + '<div class="paperList bhsSections">' + this.renderSections() + '</div>'
            + '<label class="selectLabel" for="bhsNewType" style="display:block;margin-top:1.5em">' + escapeHtml(t('ConfigSectionType')) + '</label>'
            + '<div class="flex bhsAddRow" style="gap:1em">'
            + '<div class="selectContainer flex-grow" style="margin:0"><select is="emby-select" id="bhsNewType" class="bhsNewType">'
            + optionsHtml(typeOptions) + '</select></div>'
            + '<button is="emby-button" type="button" class="raised" data-action="add" style="margin:0;padding-top:0;padding-bottom:0"><span>' + escapeHtml(t('ConfigAddSection')) + '</span></button>'
            + '</div>'
            + '</div>'
            + '<button is="emby-button" type="submit" class="raised button-submit block" style="margin-top:2em"><span>' + escapeHtml(t('ConfigSave')) + '</span></button>'
            + '</form>';

        this.renderEditor();
    }

    renderSections() {
        const t = this.t;
        const sections = this.config.Sections;

        if (!sections.length) {
            return '<div class="listItem"><div class="listItemBody"><div class="listItemBodyText secondary">'
                + escapeHtml(t('ConfigNoSections')) + '</div></div></div>';
        }

        return sections.map((section, index) => {
            const type = this.bhs.sectionTypes[section.Type];
            const details = [t('Type' + section.Type), t('ViewMode' + section.ViewMode)];
            if (type && type.orders.length > 1) {
                details.push(t('Order' + section.Order));
            }
            if (!section.Visible) {
                details.push(t('ConfigHidden'));
            }

            // The separator is under the settings of the section, and clicking the row opens or closes them
            return '<div class="bhsSection listItem-border" data-id="' + escapeHtml(section.Id) + '">'
                + '<div class="listItem" data-action="edit" style="cursor:pointer' + (section.Visible ? '' : ';opacity:.5') + '">'
                + '<span class="material-icons listItemIcon listItemIcon-transparent ' + (type ? type.icon : 'help') + '" aria-hidden="true"></span>'
                + '<div class="listItemBody two-line">'
                + '<div class="listItemBodyText">' + escapeHtml(this.getTitle(section)) + '</div>'
                + '<div class="listItemBodyText secondary">' + escapeHtml(details.join(' · ')) + '</div>'
                + '</div>'
                + this.iconButton('visibility', section.Visible ? 'visibility' : 'visibility_off', t(section.Visible ? 'ConfigHide' : 'ConfigShow'))
                + this.iconButton('up', 'arrow_upward', t('ConfigMoveUp'), index === 0)
                + this.iconButton('down', 'arrow_downward', t('ConfigMoveDown'), index === sections.length - 1)
                + this.iconButton('edit', 'edit', t('ConfigEdit'))
                + this.iconButton('remove', 'delete', t('ConfigRemove'))
                + '</div>'
                + '<div class="bhsEditor hide" style="padding:1em 1em 0.5em"></div>'
                + '</div>';
        }).join('');
    }

    iconButton(action, icon, title, disabled) {
        return '<button is="paper-icon-button-light" type="button" data-action="' + action + '" title="' + escapeHtml(title) + '"'
            + (disabled ? ' disabled' : '') + '><span class="material-icons ' + icon + '" aria-hidden="true"></span></button>';
    }

    /** Renders the settings of the section being edited, under its row. */
    renderEditor() {
        const section = this.editingId ? this.findSection(this.editingId) : null;
        const container = section ? this.root.querySelector('.bhsSection[data-id="' + section.Id + '"] .bhsEditor') : null;
        if (!container) {
            this.editingId = null;
            return Promise.resolve();
        }

        const t = this.t;
        const type = this.bhs.sectionTypes[section.Type];
        const itemPromise = type.item ? this.getItemOptions(section) : Promise.resolve([]);

        return itemPromise.then((items) => {
            let html = '';

            if (type.usesLibrary) {
                const libraryOptions = [{ value: '', label: t('ConfigAllLibraries') }].concat(this.libraries.map(function (library) {
                    return { value: library.Id, label: library.Name };
                }));
                html += this.selectHtml('LibraryId', t('ConfigLibrary'), libraryOptions, section.LibraryId);
            }

            if (type.item) {
                const itemOptions = [{ value: '', label: t('ConfigSelect') }].concat(items.map(function (item) {
                    return { value: item.Id, label: item.Name };
                }));
                html += this.selectHtml('ItemId', t('Config' + type.item), itemOptions, section.ItemId);
            }

            html += this.selectHtml('ViewMode', t('ConfigViewMode'), VIEW_MODES.map(function (mode) {
                return { value: mode, label: t('ViewMode' + mode) };
            }), section.ViewMode);

            if (type.orders.length > 1) {
                html += this.selectHtml('Order', t('ConfigOrder'), type.orders.map(function (order) {
                    return { value: order, label: t('Order' + order) };
                }), section.Order);
            }

            html += '<div class="inputContainer"><input is="emby-input" type="text" data-field="Title" label="' + escapeHtml(t('ConfigTitle'))
                + '" value="' + escapeHtml(section.Title) + '" />'
                + '<div class="fieldDescription">' + escapeHtml(t('ConfigTitleHelp')) + '</div></div>';

            container.innerHTML = html;
            container.classList.remove('hide');
        });
    }

    selectHtml(field, label, options, value) {
        return '<div class="selectContainer"><select is="emby-select" data-field="' + field + '" label="' + escapeHtml(label) + '">'
            + optionsHtml(options, value) + '</select></div>';
    }

    /** Re-renders the list of sections, keeping the rest of the form. */
    refreshSections() {
        this.root.querySelector('.bhsSections').innerHTML = this.renderSections();
        return this.renderEditor();
    }

    // ---------------------------------------------------------------- events

    onClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }

        const action = button.getAttribute('data-action');
        const row = button.closest('.bhsSection');
        const sections = this.config.Sections;
        const index = row ? sections.findIndex(function (section) {
            return section.Id === row.getAttribute('data-id');
        }) : -1;

        switch (action) {
            case 'add': {
                const type = this.root.querySelector('.bhsNewType').value;
                const definition = this.bhs.sectionTypes[type];
                const section = {
                    Id: createId(),
                    Type: type,
                    LibraryId: '',
                    ItemId: '',
                    ViewMode: definition.viewMode,
                    Order: definition.orders[0],
                    Visible: true,
                    Title: ''
                };
                sections.push(section);
                this.editingId = section.Id;
                break;
            }
            case 'visibility':
                sections[index].Visible = !sections[index].Visible;
                break;
            case 'up':
            case 'down': {
                const target = action === 'up' ? index - 1 : index + 1;
                if (target < 0 || target >= sections.length) {
                    return;
                }
                const moved = sections.splice(index, 1)[0];
                sections.splice(target, 0, moved);
                break;
            }
            case 'edit':
                this.editingId = this.editingId === sections[index].Id ? null : sections[index].Id;
                break;
            case 'remove':
                if (this.editingId === sections[index].Id) {
                    this.editingId = null;
                }
                sections.splice(index, 1);
                break;
            default:
                return;
        }

        this.refreshSections();
    }

    onChange(event) {
        const field = event.target.getAttribute('data-field');
        if (!field) {
            return;
        }

        const row = event.target.closest('.bhsSection');
        if (!row) {
            // General settings
            this.config[field] = event.target.value.trim();
            if (field === 'Language') {
                this.loadTranslations().then(() => this.render());
            }
            return;
        }

        const section = this.findSection(row.getAttribute('data-id'));
        section[field] = event.target.value;
        if (field === 'LibraryId') {
            // The genres and studios depend on the library
            section.ItemId = '';
        }

        this.refreshSections();
    }

    onSubmit(event) {
        event.preventDefault();

        const t = this.t;
        const isMissingItem = this.config.Sections.some((section) => {
            return this.bhs.sectionTypes[section.Type].item && !section.ItemId;
        });
        if (isMissingItem) {
            Dashboard.alert(t('ConfigMissingItem'));
            return;
        }

        Dashboard.showLoadingMsg();
        this.apiClient.updatePluginConfiguration(PLUGIN_ID, this.config).then(function (result) {
            Dashboard.processPluginConfigurationUpdateResult(result);
        }).catch(function (error) {
            console.error('[BetterHomeSections]', error);
            Dashboard.hideLoadingMsg();
        });
    }
}

/**
 * Loads the configuration and renders the page.
 * @param {HTMLElement} view The page element.
 * @param {Object} settings The client settings of the plugin (version and languages).
 * @param {{ isScriptMissing: boolean }} options Whether the plugin script is missing from the web client.
 */
export function init(view, settings, options) {
    const apiClient = window.ApiClient;

    return Promise.all([
        apiClient.getPluginConfiguration(PLUGIN_ID),
        // Same order as in Jellyfin
        apiClient.getJSON(apiClient.getUrl('UserViews', { UserId: apiClient.getCurrentUserId(), IncludeExternalContent: false })),
        apiClient.getJSON(apiClient.getUrl('Items', {
            UserId: apiClient.getCurrentUserId(),
            IncludeItemTypes: 'BoxSet',
            Recursive: true,
            SortBy: 'SortName',
            EnableImages: false,
            EnableTotalRecordCount: false
        }))
    ]).then(function (results) {
        const libraries = (results[1].Items || []).filter(function (view) {
            return ['boxsets', 'playlists', 'livetv'].indexOf(view.CollectionType) === -1;
        }).map(function (view) {
            return { Id: view.Id, Name: view.Name, CollectionType: view.CollectionType };
        });

        const config = results[0];
        if (!config.Language) {
            // Not chosen yet: the language of the Jellyfin interface if available, English otherwise
            config.Language = window.BetterHomeSections.resolveLanguage(settings);
        }

        const page = new ConfigPage(view, settings, config, libraries, results[2].Items || [], options);
        return page.loadTranslations().then(function () {
            return page.loadReferencedItems();
        }).then(function () {
            page.render();
        });
    });
}
