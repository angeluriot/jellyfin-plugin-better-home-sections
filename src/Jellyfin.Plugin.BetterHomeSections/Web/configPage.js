/**
 * Better Home Sections - configuration page.
 * Edits the plugin configuration (language, test commit, sections, genres and studios) with the built-in plugin configuration API.
 */

const PLUGIN_ID = '80baa139-52ad-44e9-8d33-a45544c4a962';

const VIEW_MODES = ['Portrait', 'Landscape'];

const TABS = ['General', 'Sections', 'Genres', 'Studios'];

/** The lists of the genres and studios tabs, with the configuration field of their hidden entries. */
const CATEGORIES = {
    Genres: { path: 'Genres', excludedField: 'ExcludedGenres' },
    Studios: { path: 'Studios', excludedField: 'ExcludedStudios' }
};

// The select of the new section has its label outside, so it is aligned with the button next to it
const STYLE = '<style>'
    + '.bhsAddRow .selectLabel{display:none}'
    + '.bhsAddRow .selectArrowContainer{top:0;bottom:0;display:flex;align-items:center}.bhsAddRow .selectArrow{margin:0}'
    + '.bhsTabs{display:flex;flex-wrap:wrap;margin:0.5em 0 1.5em;border-bottom:1px solid var(--jf-palette-divider,rgba(255,255,255,.12))}'
    + '.bhsTab{background:none;border:0;border-bottom:2px solid transparent;color:inherit;cursor:pointer;font:inherit;opacity:.7;padding:.8em 1.2em}'
    + '.bhsTab-active{border-bottom-color:var(--jf-palette-primary-main,#00a4dc);opacity:1}'
    + '.bhsCount{opacity:.6}'
    + '.bhsSwatch{flex-shrink:0;width:2.2em;height:1.4em;margin:0 1em 0 .5em;border-radius:.2em}'
    + '.bhsSwatch-random{background:conic-gradient(#991b1b,#d47c1d,#e4ed55,#21cb51,#01b4e4,#5b21b6,#9d174d,#991b1b)}'
    + '.bhsGenreEditor .bhs-genrePreview{width:100%;max-width:24em;margin-bottom:1.5em;border-radius:.3em}'
    + '</style>';

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
        this.categoryLists = {};
        this.genreItems = {};
        this.itemNames = {};
        this.editingId = null;
        this.editingGenreId = null;
        this.activeTab = 'Sections';
        this.t = null;

        this.root.addEventListener('click', this.onClick.bind(this));
        this.root.addEventListener('change', this.onChange.bind(this));
        this.root.addEventListener('input', this.onInput.bind(this));
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

    /** Options of the item select of a section (shown genres and studios, or collections). */
    getItemOptions(section) {
        const kind = this.bhs.sectionTypes[section.Type].item;
        if (kind === 'Collection') {
            return Promise.resolve(this.collections);
        }
        const excluded = this.config[CATEGORIES[kind + 's'].excludedField];
        return this.loadCategories(kind, section.LibraryId).then(function (items) {
            return items.filter(function (item) {
                return item.Id === section.ItemId || excluded.indexOf(item.Id) === -1;
            });
        });
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

    /** The genres or studios of all libraries having movies or series, those with the most first, cached. */
    loadCategoryList(kind) {
        if (!this.categoryLists[kind]) {
            const itemTypes = this.bhs.getItemTypes(null);
            this.categoryLists[kind] = this.apiClient.getJSON(this.apiClient.getUrl(CATEGORIES[kind].path, {
                UserId: this.apiClient.getCurrentUserId(),
                IncludeItemTypes: itemTypes,
                EnableImages: false,
                EnableTotalRecordCount: false
            })).then((result) => {
                return (result.Items || []).map((category) => {
                    return { Id: category.Id, Name: category.Name, Count: this.bhs.getContentCount(category, itemTypes) };
                }).filter(function (category) {
                    return category.Count > 0;
                }).sort(function (a, b) {
                    return b.Count - a.Count || a.Name.localeCompare(b.Name);
                });
            }).catch((error) => {
                console.error('[BetterHomeSections]', error);
                this.categoryLists[kind] = null;
                return [];
            });
        }
        return this.categoryLists[kind];
    }

    isExcluded(kind, id) {
        return this.config[CATEGORIES[kind].excludedField].indexOf(id) !== -1;
    }

    setExcluded(kind, id, isExcluded) {
        const excluded = this.config[CATEGORIES[kind].excludedField];
        const index = excluded.indexOf(id);
        if (isExcluded && index === -1) {
            excluded.push(id);
        } else if (!isExcluded && index !== -1) {
            excluded.splice(index, 1);
        }
    }

    /** The color and media chosen for a genre, empty for random. */
    getGenreSetting(id) {
        return this.config.Genres.find(function (genre) {
            return genre.GenreId === id;
        }) || { GenreId: id, Color: '', ItemId: '' };
    }

    setGenreSetting(id, field, value) {
        const genres = this.config.Genres;
        let setting = genres.find(function (genre) {
            return genre.GenreId === id;
        });
        if (!setting) {
            setting = { GenreId: id, Color: '', ItemId: '' };
            genres.push(setting);
        }
        setting[field] = value;
        // Only the customized genres are saved
        if (!setting.Color && !setting.ItemId) {
            genres.splice(genres.indexOf(setting), 1);
        }
    }

    /** Loads the names of the media chosen for the genres, so they can be displayed. */
    loadChosenItemNames() {
        const ids = this.config.Genres.map(function (genre) {
            return genre.ItemId;
        }).filter((id) => {
            return id && !this.itemNames[id];
        });
        if (!ids.length) {
            return Promise.resolve();
        }
        return this.apiClient.getJSON(this.apiClient.getUrl('Items', {
            UserId: this.apiClient.getCurrentUserId(),
            Ids: ids.join(','),
            EnableImages: false,
            EnableTotalRecordCount: false
        })).then((result) => {
            (result.Items || []).forEach((item) => {
                this.itemNames[item.Id] = item.Name;
            });
        }).catch(function (error) {
            console.error('[BetterHomeSections]', error);
        });
    }

    /** Movies and series of a genre, that can illustrate it, cached. */
    loadGenreItems(id) {
        if (!this.genreItems[id]) {
            this.genreItems[id] = this.apiClient.getJSON(this.apiClient.getUrl('Items', {
                UserId: this.apiClient.getCurrentUserId(),
                GenreIds: id,
                IncludeItemTypes: this.bhs.getItemTypes(null),
                Recursive: true,
                SortBy: 'SortName',
                Fields: 'ProductionYear',
                ImageTypeLimit: 1,
                EnableImageTypes: 'Backdrop,Primary',
                EnableTotalRecordCount: false
            })).then(function (result) {
                return (result.Items || []).filter(function (item) {
                    return (item.BackdropImageTags && item.BackdropImageTags.length) || (item.ImageTags && item.ImageTags.Primary);
                });
            }).catch(function (error) {
                console.error('[BetterHomeSections]', error);
                return [];
            });
        }
        return this.genreItems[id];
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
        const tabs = TABS.map((tab) => {
            return '<button type="button" class="bhsTab' + (tab === this.activeTab ? ' bhsTab-active' : '') + '" data-action="tab" data-tab="' + tab + '">'
                + escapeHtml(t('ConfigTab' + tab)) + '</button>';
        }).join('');

        this.root.innerHTML = STYLE
            + '<form class="bhsForm">'
            + '<div class="sectionTitleContainer flex align-items-center"><h2 class="sectionTitle">Better Home Sections</h2></div>'
            + (this.isScriptMissing ? '<p class="fieldDescription" style="color:#e57373">' + escapeHtml(t('ConfigMissingDependency')) + '</p>' : '')
            + '<div class="bhsTabs">' + tabs + '</div>'
            + this.panelHtml('General', ''
            + '<div class="selectContainer"><select is="emby-select" data-field="Language" label="' + escapeHtml(t('ConfigLanguage')) + '">'
            + optionsHtml(languageOptions, this.config.Language) + '</select></div>'
            + '<div class="inputContainer"><input is="emby-input" type="text" data-field="CommitHash" maxlength="40" autocomplete="off" label="'
            + escapeHtml(t('ConfigCommitHash')) + '" value="' + escapeHtml(this.config.CommitHash) + '" />'
            + '<div class="fieldDescription">' + escapeHtml(t('ConfigCommitHashHelp')) + '</div></div>')
            + this.panelHtml('Sections', ''
            + '<p class="fieldDescription">' + escapeHtml(t('ConfigSectionsHelp')) + '</p>'
            + '<div class="paperList bhsSections">' + this.renderSections() + '</div>'
            + '<label class="selectLabel" for="bhsNewType" style="display:block;margin-top:1.5em">' + escapeHtml(t('ConfigSectionType')) + '</label>'
            + '<div class="flex bhsAddRow" style="gap:1em">'
            + '<div class="selectContainer flex-grow" style="margin:0"><select is="emby-select" id="bhsNewType" class="bhsNewType">'
            + optionsHtml(typeOptions) + '</select></div>'
            + '<button is="emby-button" type="button" class="raised" data-action="add" style="margin:0;padding-top:0;padding-bottom:0"><span>' + escapeHtml(t('ConfigAddSection')) + '</span></button>'
            + '</div>')
            + this.categoryPanelHtml('Genres')
            + this.categoryPanelHtml('Studios')
            + '<button is="emby-button" type="submit" class="raised button-submit block" style="margin-top:2em"><span>' + escapeHtml(t('ConfigSave')) + '</span></button>'
            + '</form>';

        this.renderEditor();
        if (CATEGORIES[this.activeTab]) {
            this.renderCategories(this.activeTab);
        }
    }

    panelHtml(tab, content) {
        return '<div class="bhsPanel' + (tab === this.activeTab ? '' : ' hide') + '" data-tab="' + tab + '">' + content + '</div>';
    }

    /** The tab of the genres or studios: search, buttons to show or hide all of them, and their list. */
    categoryPanelHtml(kind) {
        const t = this.t;
        return this.panelHtml(kind, ''
            + '<p class="fieldDescription">' + escapeHtml(t('Config' + kind + 'Help')) + '</p>'
            + '<div class="inputContainer"><input is="emby-input" type="search" class="bhsCategorySearch" data-kind="' + kind + '" autocomplete="off" label="'
            + escapeHtml(t('ConfigSearch')) + '" /></div>'
            + '<div class="flex" style="gap:1em;margin-bottom:1.5em">'
            + '<button is="emby-button" type="button" class="raised" data-action="showCategories" data-kind="' + kind + '" style="margin:0"><span>'
            + escapeHtml(t('ConfigShowAll')) + '</span></button>'
            + '<button is="emby-button" type="button" class="raised" data-action="hideCategories" data-kind="' + kind + '" style="margin:0"><span>'
            + escapeHtml(t('ConfigHideAll')) + '</span></button>'
            + '</div>'
            + '<div class="paperList bhsCategories" data-kind="' + kind + '"></div>');
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

    /** The genres or studios with an eye to show or hide each of them, the genres can also be clicked to choose their picture. */
    renderCategories(kind) {
        const t = this.t;
        const container = this.root.querySelector('.bhsCategories[data-kind="' + kind + '"]');
        const isGenre = kind === 'Genres';

        return Promise.all([this.loadCategoryList(kind), isGenre ? this.loadChosenItemNames() : null]).then((results) => {
            const categories = results[0];
            if (!categories.length) {
                container.innerHTML = '<p class="fieldDescription">' + escapeHtml(t('ConfigNo' + kind)) + '</p>';
                return;
            }

            container.innerHTML = categories.map((category) => {
                const isExcluded = this.isExcluded(kind, category.Id);
                let swatch = '';
                let details = '';
                if (isGenre) {
                    const setting = this.getGenreSetting(category.Id);
                    const tone = this.bhs.genreTones[setting.Color];
                    swatch = tone
                        ? '<span class="bhsSwatch" style="background:linear-gradient(135deg,#' + tone[0] + ',#' + tone[1] + ')"></span>'
                        : '<span class="bhsSwatch bhsSwatch-random"></span>';
                    details = '<div class="listItemBodyText secondary">' + escapeHtml(t('ConfigGenreDetails', {
                        color: setting.Color ? t('Color' + setting.Color) : t('ConfigRandom'),
                        media: setting.ItemId ? (this.itemNames[setting.ItemId] || '…') : t('ConfigRandom')
                    })) + '</div>';
                }

                return '<div class="bhsCategory listItem-border" data-kind="' + kind + '" data-id="' + escapeHtml(category.Id)
                    + '" data-name="' + escapeHtml(category.Name.toLowerCase()) + '">'
                    + '<div class="listItem"' + (isGenre ? ' data-action="editGenre"' : '') + ' style="' + (isGenre ? 'cursor:pointer;' : '')
                    + (isExcluded ? 'opacity:.5' : '') + '">'
                    + swatch
                    + '<div class="listItemBody' + (isGenre ? ' two-line' : '') + '">'
                    + '<div class="listItemBodyText">' + escapeHtml(category.Name) + ' <span class="bhsCount">· ' + category.Count + '</span></div>'
                    + details
                    + '</div>'
                    + this.iconButton('toggleCategory', isExcluded ? 'visibility_off' : 'visibility', t(isExcluded ? 'ConfigShow' : 'ConfigHide'))
                    + '</div>'
                    + (isGenre ? '<div class="bhsGenreEditor hide" style="padding:1em 1em 0.5em"></div>' : '')
                    + '</div>';
            }).join('');

            this.filterCategories(kind);
            if (isGenre) {
                this.renderGenreEditor();
            }
        });
    }

    /** Renders the color, media and preview of the genre being edited, under its row. */
    renderGenreEditor() {
        const id = this.editingGenreId;
        const container = id ? this.root.querySelector('.bhsCategory[data-kind="Genres"][data-id="' + id + '"] .bhsGenreEditor') : null;
        if (!container) {
            this.editingGenreId = null;
            return Promise.resolve();
        }

        const t = this.t;
        return this.loadGenreItems(id).then((items) => {
            const setting = this.getGenreSetting(id);
            const colorOptions = [{ value: '', label: t('ConfigRandom') }].concat(Object.keys(this.bhs.genreTones).map(function (color) {
                return { value: color, label: t('Color' + color) };
            }));
            const itemOptions = [{ value: '', label: t('ConfigRandom') }].concat(items.map(function (item) {
                return { value: item.Id, label: item.Name + (item.ProductionYear ? ' (' + item.ProductionYear + ')' : '') };
            }));
            const name = container.closest('.bhsCategory').querySelector('.listItemBodyText').firstChild.textContent;

            container.innerHTML = this.selectHtml('GenreColor', t('ConfigColor'), colorOptions, setting.Color)
                + this.selectHtml('GenreItem', t('ConfigMedia'), itemOptions, setting.ItemId)
                + '<div class="bhs-genrePreview"></div>';
            container.classList.remove('hide');

            // Like on the home screen, a random media if none is chosen
            const item = items.find(function (candidate) {
                return candidate.Id === setting.ItemId;
            }) || items[Math.floor(Math.random() * items.length)];
            this.bhs.renderGenrePreview(container.querySelector('.bhs-genrePreview'), name.trim(), setting.Color, item || null);
        });
    }

    /** Hides the genres or studios not matching the search. */
    filterCategories(kind) {
        const search = (this.root.querySelector('.bhsCategorySearch[data-kind="' + kind + '"]').value || '').trim().toLowerCase();
        this.root.querySelectorAll('.bhsCategory[data-kind="' + kind + '"]').forEach(function (row) {
            row.classList.toggle('hide', search !== '' && row.getAttribute('data-name').indexOf(search) === -1);
        });
    }

    // ---------------------------------------------------------------- events

    onClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }

        const action = button.getAttribute('data-action');
        const category = button.closest('.bhsCategory');

        switch (action) {
            case 'tab':
                this.activeTab = button.getAttribute('data-tab');
                this.root.querySelectorAll('.bhsTab').forEach((tab) => {
                    tab.classList.toggle('bhsTab-active', tab === button);
                });
                this.root.querySelectorAll('.bhsPanel').forEach((panel) => {
                    panel.classList.toggle('hide', panel.getAttribute('data-tab') !== this.activeTab);
                });
                if (CATEGORIES[this.activeTab]) {
                    this.renderCategories(this.activeTab);
                }
                return;
            case 'toggleCategory': {
                const kind = category.getAttribute('data-kind');
                const id = category.getAttribute('data-id');
                this.setExcluded(kind, id, !this.isExcluded(kind, id));
                this.renderCategories(kind);
                return;
            }
            case 'showCategories':
            case 'hideCategories': {
                // Only the genres or studios matching the search
                const kind = button.getAttribute('data-kind');
                this.root.querySelectorAll('.bhsCategory[data-kind="' + kind + '"]:not(.hide)').forEach((row) => {
                    this.setExcluded(kind, row.getAttribute('data-id'), action === 'hideCategories');
                });
                this.renderCategories(kind);
                return;
            }
            case 'editGenre': {
                const id = category.getAttribute('data-id');
                this.editingGenreId = this.editingGenreId === id ? null : id;
                this.renderCategories('Genres');
                return;
            }
            default:
                break;
        }

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

    onInput(event) {
        if (event.target.classList.contains('bhsCategorySearch')) {
            this.filterCategories(event.target.getAttribute('data-kind'));
        }
    }

    onChange(event) {
        const field = event.target.getAttribute('data-field');
        if (!field) {
            return;
        }

        const category = event.target.closest('.bhsCategory');
        if (category) {
            this.setGenreSetting(category.getAttribute('data-id'), field === 'GenreColor' ? 'Color' : 'ItemId', event.target.value);
            this.renderCategories('Genres');
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
        config.ExcludedStudios = config.ExcludedStudios || [];
        config.ExcludedGenres = config.ExcludedGenres || [];
        config.Genres = config.Genres || [];
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
