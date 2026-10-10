/**
 * Better Home Sections - renders the home screen sections configured by the administrator.
 *
 * The plugin patches the web client so its `loadSections` function calls `BetterHomeSections.loadSections`.
 * Sections are rendered with the same markup, custom elements and card builder as the native ones,
 * so themes and other plugins keep working, and their items come from the Jellyfin API.
 */
(function () {
    'use strict';

    if (window.BetterHomeSections) {
        return;
    }

    const LOG_PREFIX = '[BetterHomeSections]';

    /** Maximum number of items displayed in a section of cards. */
    const ITEM_LIMIT = 20;

    /** Maximum number of tiles displayed in a genres or studios section. */
    const TILE_LIMIT = 40;

    /** Number of random items fetched to illustrate the genre tiles. */
    const GENRE_IMAGE_SAMPLE_SIZE = 300;

    const IMAGE_TYPES = 'Primary,Backdrop,Thumb';

    /** Item types listed by each library type, used for the genre, studio and item queries. */
    const LIBRARY_ITEM_TYPES = {
        movies: 'Movie',
        tvshows: 'Series',
        music: 'MusicAlbum',
        musicvideos: 'MusicVideo',
        books: 'Book,AudioBook',
        homevideos: 'Video',
        boxsets: 'BoxSet'
    };

    /** Item types listed when a section is not limited to a library. */
    const ALL_ITEM_TYPES = 'Movie,Series';

    /** Number of matching items of each type in a genre or studio returned by the API. */
    const COUNT_FIELDS = {
        Movie: 'MovieCount',
        Series: 'SeriesCount',
        MusicAlbum: 'AlbumCount',
        MusicVideo: 'MusicVideoCount'
    };

    const FAVORITE_ITEM_TYPES = 'Movie,Series,Season,Episode,Video,MusicVideo,MusicAlbum,Book,AudioBook,BoxSet';

    /** Library views of the web client and the index of their genres / studios tabs. */
    const LIBRARY_VIEWS = {
        movies: { route: 'movies', tabs: { genres: 4, studios: 5 } },
        tvshows: { route: 'tv', tabs: { genres: 3, studios: 4 } },
        music: { route: 'music', tabs: { genres: 6 } }
    };

    /** Duotone colors (shadows, highlights) of the genre tiles, the same as Seerr. */
    const GENRE_TONES = [
        ['991B1B', 'FCA5A5'],
        ['1F2937', 'F87171'],
        ['032541', '01B4E4'],
        ['1F2937', '60A5FA'],
        ['1F2937', '2864D2'],
        ['92400E', 'FCD34D'],
        ['065F46', '6EE7B7'],
        ['087D29', '21CB51'],
        ['5B21B6', 'C4B5FD'],
        ['777E0D', 'E4ED55'],
        ['552C01', 'D47C1D'],
        ['1F2937', 'D1D5DB'],
        ['9D174D', 'F9A8D4'],
        ['480C8B', 'A96BEF']
    ];

    /**
     * The section types: library / item they use, available orders, default view mode and how they are loaded and rendered.
     * Keep in sync with SectionType in the plugin configuration.
     */
    const SECTION_TYPES = {
        ContinueWatching: {
            icon: 'play_arrow',
            orders: ['Default'],
            viewMode: 'Landscape',
            monitor: 'videoplayback,markplayed',
            fetch: fetchContinueWatching,
            render: renderCards
        },
        RecentlyAdded: {
            icon: 'new_releases',
            usesLibrary: true,
            orders: ['LastAdded'],
            viewMode: 'Portrait',
            monitor: 'markplayed',
            fetch: fetchRecentlyAdded,
            render: renderCards
        },
        Genres: {
            icon: 'category',
            usesLibrary: true,
            orders: ['MostItems', 'Random'],
            viewMode: 'Landscape',
            fetch: fetchGenreTiles,
            render: renderTiles
        },
        Genre: {
            icon: 'local_offer',
            usesLibrary: true,
            item: 'Genre',
            orders: ['LastAdded', 'Random'],
            viewMode: 'Portrait',
            monitor: 'markplayed',
            fetch: fetchGenreItems,
            render: renderCards
        },
        Studios: {
            icon: 'business',
            usesLibrary: true,
            orders: ['MostItems', 'Random'],
            viewMode: 'Landscape',
            fetch: fetchStudioTiles,
            render: renderTiles
        },
        Studio: {
            icon: 'apartment',
            usesLibrary: true,
            item: 'Studio',
            orders: ['LastAdded', 'Random'],
            viewMode: 'Portrait',
            monitor: 'markplayed',
            fetch: fetchStudioItems,
            render: renderCards
        },
        Collections: {
            icon: 'video_library',
            orders: ['MostItems', 'LastAdded', 'Random'],
            viewMode: 'Landscape',
            fetch: fetchCollections,
            render: renderCards
        },
        Collection: {
            icon: 'folder',
            item: 'Collection',
            orders: ['LastAdded', 'Random'],
            viewMode: 'Portrait',
            monitor: 'markplayed',
            fetch: fetchCollectionItems,
            render: renderCards
        },
        Favorites: {
            icon: 'favorite',
            orders: ['Default'],
            viewMode: 'Landscape',
            monitor: 'markplayed',
            fetch: fetchFavorites,
            render: renderCards
        },
        NextUp: {
            icon: 'skip_next',
            orders: ['Default'],
            viewMode: 'Landscape',
            monitor: 'videoplayback,markplayed',
            fetch: fetchNextUp,
            render: renderCards
        }
    };

    // ------------------------------------------------------------------ helpers

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function shuffle(list) {
        const result = list.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = result[i];
            result[i] = result[j];
            result[j] = tmp;
        }
        return result;
    }

    function getJson(ctx, path, params) {
        return ctx.apiClient.getJSON(ctx.apiClient.getUrl(path, params));
    }

    function toItems(result) {
        return (result && result.Items) || result || [];
    }

    function isTvLayout() {
        return document.documentElement.classList.contains('layout-tv');
    }

    /** The modern (React) layout of Jellyfin 12, which has more library tabs than the legacy one. */
    function isModernLayout() {
        return document.querySelector('.MuiAppBar-root') !== null;
    }

    function getItemTypes(library) {
        return (library && LIBRARY_ITEM_TYPES[library.CollectionType]) || ALL_ITEM_TYPES;
    }

    function isMusicLibrary(library) {
        return !!library && library.CollectionType === 'music';
    }

    function getLibraryId(section) {
        return section.Library ? section.Library.Id : undefined;
    }

    function getSortParams(order) {
        if (order === 'Random') {
            return { SortBy: 'Random' };
        }
        return { SortBy: 'DateCreated,SortName', SortOrder: 'Descending' };
    }

    /** Orders genres, studios or collections, which have their number of movies / series in ContentCount. */
    function sortByOrder(list, order) {
        if (order === 'Random') {
            return shuffle(list);
        }
        if (order === 'MostItems') {
            return list.slice().sort(function (a, b) {
                return (b.ContentCount || 0) - (a.ContentCount || 0) || String(a.Name).localeCompare(String(b.Name));
            });
        }
        return list;
    }

    /**
     * Number of items of the listed types in a genre or studio. ChildCount is not used because it also counts
     * the episodes, seasons and collections having the genre or studio.
     */
    function getContentCount(category, itemTypes) {
        let count = 0;
        let isKnown = false;
        itemTypes.split(',').forEach(function (type) {
            const value = category[COUNT_FIELDS[type]];
            if (typeof value === 'number') {
                count += value;
                isKnown = true;
            }
        });
        return isKnown ? count : (category.ChildCount || 0);
    }

    // ----------------------------------------------------------- settings & i18n

    const translationCache = {};

    function getSettings(apiClient) {
        return apiClient.getJSON(apiClient.getUrl('BetterHomeSections/Settings'));
    }

    /** The language chosen by the administrator, or the one of the Jellyfin interface. */
    function resolveLanguage(settings) {
        const wanted = (settings.Language || document.documentElement.lang || navigator.language || 'en').toLowerCase();
        const codes = (settings.Languages || []).map(function (language) {
            return language.Code;
        });
        const exact = codes.find(function (code) {
            return code.toLowerCase() === wanted;
        });
        if (exact) {
            return exact;
        }
        const base = codes.find(function (code) {
            return code.toLowerCase() === wanted.split('-')[0];
        });
        return base || 'en';
    }

    function fetchTranslations(apiClient, settings, code) {
        const key = code + '|' + settings.Version;
        if (!translationCache[key]) {
            const url = apiClient.getUrl('BetterHomeSections/Web/Localization/' + code + '.json', { v: settings.Version });
            translationCache[key] = fetch(url)
                .then(function (response) {
                    return response.ok ? response.json() : {};
                })
                .catch(function (error) {
                    console.error(LOG_PREFIX, 'Failed to load the translations', code, error);
                    delete translationCache[key];
                    return {};
                });
        }
        return translationCache[key];
    }

    /**
     * Loads the translations of the plugin language (English for the missing strings).
     * @returns {Promise<function(string, Object=): string>} The translation function.
     */
    function loadTranslator(apiClient, settings) {
        const code = resolveLanguage(settings);
        const codes = code === 'en' ? ['en'] : ['en', code];

        return Promise.all(codes.map(function (c) {
            return fetchTranslations(apiClient, settings, c);
        })).then(function (dictionaries) {
            const strings = Object.assign.apply(null, [{}].concat(dictionaries));
            return function translate(key, params) {
                const text = Object.prototype.hasOwnProperty.call(strings, key) ? strings[key] : key;
                return text.replace(/\{(\w+)\}/g, function (match, name) {
                    return params && params[name] != null ? params[name] : match;
                });
            };
        });
    }

    /** The title of a section: the custom one, or one generated from its type, library and item. */
    function getSectionTitle(section, t) {
        if (section.Title) {
            return section.Title;
        }

        const library = section.Library;
        const libraryName = library ? library.Name : '';
        const itemName = section.Item ? section.Item.Name : '';

        switch (section.Type) {
            case 'ContinueWatching':
                return t('SectionContinueWatching');
            case 'NextUp':
                return t('SectionNextUp');
            case 'Favorites':
                return t('SectionFavorites');
            case 'Collections':
                return t('SectionCollections');
            case 'Collection':
                return itemName;
            case 'RecentlyAdded':
                return library ? t('SectionRecentlyAddedLibrary', { library: libraryName }) : t('SectionRecentlyAdded');
            case 'Genres':
                return library ? t('SectionGenresLibrary', { library: libraryName }) : t('SectionGenres');
            case 'Genre':
                return library ? t('SectionGenreLibrary', { genre: itemName, library: libraryName }) : itemName;
            case 'Studios':
                if (!library) {
                    return t('SectionStudios');
                }
                return t(library.CollectionType === 'tvshows' ? 'SectionNetworksLibrary' : 'SectionStudiosLibrary', { library: libraryName });
            case 'Studio':
                return library ? t('SectionStudioLibrary', { studio: itemName, library: libraryName }) : itemName;
            default:
                return '';
        }
    }

    // ------------------------------------------------------------------- routes

    function getLibraryUrl(ctx, library, tab) {
        const id = encodeURIComponent(library.Id);
        const view = LIBRARY_VIEWS[library.CollectionType];

        if (!view) {
            return '#/list?parentId=' + id + '&serverId=' + encodeURIComponent(ctx.serverId);
        }

        let url = '#/' + view.route + '?topParentId=' + id + '&collectionType=' + encodeURIComponent(library.CollectionType);
        const tabIndex = tab ? view.tabs[tab] : undefined;
        // The legacy layout has no studios tab in movie libraries
        const hasTab = tabIndex !== undefined && !(tab === 'studios' && library.CollectionType === 'movies' && !isModernLayout());
        if (hasTab) {
            url += '&tab=' + tabIndex;
        }
        return url;
    }

    function getGenreUrl(ctx, genreId, library) {
        const parameter = isMusicLibrary(library) ? 'musicGenreId' : 'genreId';
        let url = '#/list?' + parameter + '=' + encodeURIComponent(genreId) + '&serverId=' + encodeURIComponent(ctx.serverId);
        if (library) {
            url += '&parentId=' + encodeURIComponent(library.Id);
        }
        return url;
    }

    function getStudioUrl(ctx, studioId, library) {
        let url = '#/list?studioId=' + encodeURIComponent(studioId) + '&serverId=' + encodeURIComponent(ctx.serverId);
        if (library) {
            url += '&parentId=' + encodeURIComponent(library.Id);
        }
        return url;
    }

    function getCollectionsUrl(ctx) {
        const view = (ctx.userViews || []).find(function (userView) {
            return userView.CollectionType === 'boxsets';
        });
        if (!view) {
            return null;
        }
        if (isModernLayout()) {
            return '#/boxsets?topParentId=' + encodeURIComponent(view.Id) + '&collectionType=boxsets';
        }
        return '#/list?parentId=' + encodeURIComponent(view.Id) + '&serverId=' + encodeURIComponent(ctx.serverId);
    }

    /** Where the title of a section leads, or null if it is not a link. */
    function getTitleUrl(section, ctx) {
        const library = section.Library;
        const item = section.Item;

        switch (section.Type) {
            case 'NextUp':
                return '#/list?type=nextup&serverId=' + encodeURIComponent(ctx.serverId);
            case 'RecentlyAdded':
                return library ? getLibraryUrl(ctx, library) : null;
            case 'Genres':
                return library ? getLibraryUrl(ctx, library, 'genres') : null;
            case 'Genre':
                return getGenreUrl(ctx, item.Id, library);
            case 'Studios':
                return library ? getLibraryUrl(ctx, library, 'studios') : null;
            case 'Studio':
                return getStudioUrl(ctx, item.Id, library);
            case 'Collections':
                return getCollectionsUrl(ctx);
            case 'Collection':
                return '#/details?id=' + encodeURIComponent(item.Id) + '&serverId=' + encodeURIComponent(ctx.serverId);
            case 'Favorites':
                return '#/home?tab=1';
            default:
                return null;
        }
    }

    // --------------------------------------------------------------- item data

    function fetchItems(ctx, params) {
        return getJson(ctx, 'Items', Object.assign({
            UserId: ctx.userId,
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio',
            ImageTypeLimit: 1,
            EnableImageTypes: IMAGE_TYPES,
            EnableTotalRecordCount: false
        }, params)).then(toItems);
    }

    function fetchContinueWatching(section, ctx) {
        return getJson(ctx, 'UserItems/Resume', {
            UserId: ctx.userId,
            Limit: 12,
            Fields: 'PrimaryImageAspectRatio',
            ImageTypeLimit: 1,
            EnableImageTypes: IMAGE_TYPES,
            EnableTotalRecordCount: false,
            MediaTypes: 'Video'
        }).then(toItems);
    }

    function fetchNextUp(section, ctx) {
        const settings = ctx.userSettings;
        const maxDays = typeof settings.maxDaysForNextUp === 'function' ? settings.maxDaysForNextUp() : 365;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - maxDays);

        return getJson(ctx, 'Shows/NextUp', {
            UserId: ctx.userId,
            Limit: 24,
            Fields: 'PrimaryImageAspectRatio,DateCreated,Path,MediaSourceCount',
            ImageTypeLimit: 1,
            EnableImageTypes: IMAGE_TYPES,
            EnableTotalRecordCount: false,
            NextUpDateCutoff: cutoff.toISOString(),
            EnableResumable: false,
            EnableRewatching: typeof settings.enableRewatchingInNextUp === 'function' ? settings.enableRewatchingInNextUp() : false
        }).then(toItems);
    }

    /**
     * Latest movies / series: the latest items of Jellyfin, with the episodes and seasons replaced by their series
     * (Jellyfin only groups them when several episodes of a series were added).
     */
    function fetchRecentlyAdded(section, ctx) {
        const itemTypes = getItemTypes(section.Library).split(',');

        return getJson(ctx, 'Items/Latest', {
            UserId: ctx.userId,
            ParentId: getLibraryId(section),
            Limit: ITEM_LIMIT * 2,
            Fields: 'PrimaryImageAspectRatio,Path',
            ImageTypeLimit: 1,
            EnableImageTypes: IMAGE_TYPES
        }).then(toItems).then(function (latest) {
            const ids = [];
            const itemsById = {};
            latest.forEach(function (item) {
                const isEpisode = (item.Type === 'Episode' || item.Type === 'Season') && item.SeriesId;
                const id = isEpisode ? item.SeriesId : item.Id;
                if (!Object.prototype.hasOwnProperty.call(itemsById, id)) {
                    ids.push(id);
                    itemsById[id] = isEpisode ? null : item;
                }
            });

            const missingIds = ids.filter(function (id) {
                return !itemsById[id];
            });
            const seriesPromise = missingIds.length ? fetchItems(ctx, { Ids: missingIds.join(',') }) : Promise.resolve([]);

            return seriesPromise.then(function (series) {
                series.forEach(function (item) {
                    itemsById[item.Id] = item;
                });
                return ids.map(function (id) {
                    return itemsById[id];
                }).filter(function (item) {
                    return item && itemTypes.indexOf(item.Type) !== -1;
                }).slice(0, ITEM_LIMIT);
            });
        });
    }

    function fetchGenreItems(section, ctx) {
        return fetchItems(ctx, Object.assign({
            ParentId: getLibraryId(section),
            GenreIds: section.Item.Id,
            IncludeItemTypes: getItemTypes(section.Library),
            Limit: ITEM_LIMIT
        }, getSortParams(section.Order)));
    }

    function fetchStudioItems(section, ctx) {
        return fetchItems(ctx, Object.assign({
            ParentId: getLibraryId(section),
            StudioIds: section.Item.Id,
            IncludeItemTypes: getItemTypes(section.Library),
            Limit: ITEM_LIMIT
        }, getSortParams(section.Order)));
    }

    function fetchCollectionItems(section, ctx) {
        return fetchItems(ctx, Object.assign({
            ParentId: section.Item.Id,
            Recursive: false,
            IncludeItemTypes: ALL_ITEM_TYPES,
            Limit: ITEM_LIMIT
        }, getSortParams(section.Order)));
    }

    /** Number of movies / series in a collection, without its episodes, seasons and sub-collections. */
    function fetchCollectionContentCount(ctx, collection) {
        return getJson(ctx, 'Items', {
            UserId: ctx.userId,
            ParentId: collection.Id,
            IncludeItemTypes: ALL_ITEM_TYPES,
            Limit: 1,
            EnableImages: false,
            EnableUserData: false,
            EnableTotalRecordCount: true
        }).then(function (result) {
            collection.ContentCount = result.TotalRecordCount || 0;
        });
    }

    function fetchCollections(section, ctx) {
        if (section.Order !== 'MostItems') {
            return fetchItems(ctx, Object.assign({ IncludeItemTypes: 'BoxSet', Limit: ITEM_LIMIT }, getSortParams(section.Order)));
        }

        // There is no API sort by number of items, so all the collections are counted and sorted here
        return fetchItems(ctx, { IncludeItemTypes: 'BoxSet' }).then(function (collections) {
            return Promise.all(collections.map(function (collection) {
                return fetchCollectionContentCount(ctx, collection);
            })).then(function () {
                return sortByOrder(collections, section.Order).slice(0, ITEM_LIMIT);
            });
        });
    }

    function fetchFavorites(section, ctx) {
        return fetchItems(ctx, {
            Filters: 'IsFavorite',
            IncludeItemTypes: FAVORITE_ITEM_TYPES,
            SortBy: 'SortName',
            SortOrder: 'Ascending',
            Limit: ITEM_LIMIT
        });
    }

    // --------------------------------------------------------------- tile data

    /** Genres or studios of the section having content for the user, in the section order. */
    function fetchCategories(section, ctx, path, imageTypes) {
        const itemTypes = getItemTypes(section.Library);

        return getJson(ctx, path, {
            UserId: ctx.userId,
            ParentId: getLibraryId(section),
            // Also makes the server return the number of matching items of each type
            IncludeItemTypes: itemTypes,
            ImageTypeLimit: 1,
            EnableImageTypes: imageTypes,
            EnableTotalRecordCount: false
        }).then(function (result) {
            const categories = toItems(result).filter(function (category) {
                category.ContentCount = getContentCount(category, itemTypes);
                return category.ContentCount > 0;
            });
            return sortByOrder(categories, section.Order).slice(0, TILE_LIMIT);
        });
    }

    function getImageTag(item, imageType) {
        if (imageType === 'Backdrop') {
            return item.BackdropImageTags && item.BackdropImageTags[0];
        }
        return item.ImageTags && item.ImageTags[imageType];
    }

    function getImageUrl(ctx, itemId, imageType, tag, landscape) {
        return ctx.apiClient.getScaledImageUrl(itemId, {
            type: imageType,
            tag: tag,
            maxWidth: landscape ? 640 : 400,
            quality: 90
        });
    }

    /** Picks a random item of each genre to illustrate it, trying not to use the same item twice. */
    function pickGenreItems(section, ctx, genres, imageType) {
        const common = {
            ParentId: getLibraryId(section),
            IncludeItemTypes: getItemTypes(section.Library),
            SortBy: 'Random',
            ImageTypes: imageType,
            EnableImageTypes: imageType
        };
        const picks = {};

        return fetchItems(ctx, Object.assign({ Fields: 'Genres', Limit: GENRE_IMAGE_SAMPLE_SIZE }, common)).then(function (sample) {
            const used = {};
            genres.forEach(function (genre) {
                const item = sample.find(function (candidate) {
                    return !used[candidate.Id] && (candidate.GenreItems || []).some(function (pair) {
                        return pair.Id === genre.Id;
                    });
                });
                if (item) {
                    used[item.Id] = true;
                    picks[genre.Id] = item;
                }
            });

            // Rare genres may not be in the sample
            const missing = genres.filter(function (genre) {
                return !picks[genre.Id];
            });
            return Promise.all(missing.map(function (genre) {
                return fetchItems(ctx, Object.assign({ GenreIds: genre.Id, Limit: 1 }, common)).then(function (items) {
                    if (items[0]) {
                        picks[genre.Id] = items[0];
                    }
                });
            }));
        }).then(function () {
            return picks;
        });
    }

    function fetchGenreTiles(section, ctx) {
        const landscape = section.ViewMode === 'Landscape';
        const imageType = landscape ? 'Backdrop' : 'Primary';
        const path = isMusicLibrary(section.Library) ? 'MusicGenres' : 'Genres';

        return fetchCategories(section, ctx, path, IMAGE_TYPES).then(function (genres) {
            return pickGenreItems(section, ctx, genres, imageType).then(function (picks) {
                const tones = shuffle(GENRE_TONES);
                return genres.map(function (genre, index) {
                    const item = picks[genre.Id];
                    let imageUrl = item ? getImageUrl(ctx, item.Id, imageType, getImageTag(item, imageType), landscape) : null;
                    if (!imageUrl && getImageTag(genre, imageType)) {
                        imageUrl = getImageUrl(ctx, genre.Id, imageType, getImageTag(genre, imageType), landscape);
                    }
                    return {
                        kind: 'genre',
                        item: genre,
                        name: genre.Name,
                        url: getGenreUrl(ctx, genre.Id, section.Library),
                        imageUrl: imageUrl,
                        tone: tones[index % tones.length]
                    };
                });
            });
        });
    }

    function fetchStudioTiles(section, ctx) {
        const landscape = section.ViewMode === 'Landscape';

        return fetchCategories(section, ctx, 'Studios', 'Thumb,Primary,Logo').then(function (studios) {
            return studios.map(function (studio) {
                // Thumbs are complete illustrations, primary images and logos are logos drawn in white like in Seerr
                const imageType = ['Thumb', 'Primary', 'Logo'].find(function (type) {
                    return getImageTag(studio, type);
                });
                return {
                    kind: 'studio',
                    item: studio,
                    name: studio.Name,
                    url: getStudioUrl(ctx, studio.Id, section.Library),
                    imageUrl: imageType ? getImageUrl(ctx, studio.Id, imageType, getImageTag(studio, imageType), landscape) : null,
                    isLogo: imageType === 'Primary' || imageType === 'Logo'
                };
            });
        });
    }

    // --------------------------------------------------------------- rendering

    let cardBuilder;

    /**
     * Finds an export of the web client bundle without relying on minified names, by looking for a module
     * whose source matches and whose export matches.
     */
    function findWebClientExport(matchSource, matchExport) {
        const chunkKey = Object.keys(window).find(function (key) {
            return key.indexOf('webpackChunk') === 0 && Array.isArray(window[key]);
        });
        if (!chunkKey) {
            return null;
        }

        let webpackRequire = null;
        window[chunkKey].push([['better-home-sections-' + Date.now()], {}, function (require) {
            webpackRequire = require;
        }]);
        if (!webpackRequire || !webpackRequire.m) {
            return null;
        }

        const ids = Object.keys(webpackRequire.m);
        for (let i = 0; i < ids.length; i++) {
            let exports;
            try {
                if (!matchSource(Function.prototype.toString.call(webpackRequire.m[ids[i]]))) {
                    continue;
                }
                exports = webpackRequire(ids[i]);
            } catch (error) {
                continue;
            }
            if (matchExport(exports)) {
                return exports;
            }
            const keys = Object.keys(exports || {});
            for (let j = 0; j < keys.length; j++) {
                if (matchExport(exports[keys[j]])) {
                    return exports[keys[j]];
                }
            }
        }
        return null;
    }

    /** The card builder of the web client, used to render cards exactly like the native sections. */
    function getCardBuilder() {
        if (cardBuilder === undefined) {
            try {
                cardBuilder = findWebClientExport(function (source) {
                    return source.indexOf('getCardsHtml:') !== -1 && source.indexOf('buildCards:') !== -1;
                }, function (value) {
                    return !!value && typeof value.getCardsHtml === 'function' && typeof value.buildCards === 'function';
                });
            } catch (error) {
                console.error(LOG_PREFIX, error);
                cardBuilder = null;
            }
            if (!cardBuilder) {
                console.warn(LOG_PREFIX, 'The card builder of the web client was not found, simple cards are used instead');
            }
        }
        return cardBuilder;
    }

    function getShape(section) {
        return section.ViewMode === 'Landscape' ? 'overflowBackdrop' : 'overflowPortrait';
    }

    /** Minimal cards, only used if the card builder of the web client cannot be found. */
    function renderSimpleCards(items, section, ctx) {
        const shape = getShape(section);
        const landscape = section.ViewMode === 'Landscape';

        return items.map(function (item, index) {
            const imageType = landscape
                ? ['Thumb', 'Backdrop', 'Primary'].find(function (type) {
                    return getImageTag(item, type);
                })
                : (getImageTag(item, 'Primary') ? 'Primary' : null);
            const imageUrl = imageType ? getImageUrl(ctx, item.Id, imageType, getImageTag(item, imageType), landscape) : '';
            const url = '#/details?id=' + encodeURIComponent(item.Id) + '&serverId=' + encodeURIComponent(ctx.serverId);

            return '<div class="card ' + shape + 'Card card-hoverable" data-index="' + index + '" data-id="' + escapeHtml(item.Id)
                + '" data-serverid="' + escapeHtml(ctx.serverId) + '" data-type="' + escapeHtml(item.Type) + '">'
                + '<div class="cardBox cardBox-bottompadded"><div class="cardScalable">'
                + '<div class="cardPadder cardPadder-' + shape + '"></div>'
                + '<a href="' + escapeHtml(url) + '" class="cardImageContainer coveredImage cardContent' + (imageUrl ? ' lazy" data-src="' + escapeHtml(imageUrl) : '') + '"></a>'
                + '</div>'
                + '<div class="cardText cardTextCentered cardText-first"><bdi>' + escapeHtml(item.SeriesName || item.Name) + '</bdi></div>'
                + '</div></div>';
        }).join('');
    }

    function renderCards(items, section, ctx) {
        const builder = getCardBuilder();
        if (!builder) {
            return renderSimpleCards(items, section, ctx);
        }

        const landscape = section.ViewMode === 'Landscape';
        const isEpisodeList = section.Type === 'ContinueWatching' || section.Type === 'NextUp';
        const useEpisodeImages = typeof ctx.userSettings.useEpisodeImagesInNextUpAndResume === 'function'
            && ctx.userSettings.useEpisodeImagesInNextUpAndResume();

        // Same options as the native home sections
        return builder.getCardsHtml({
            items: items,
            shape: getShape(section),
            preferThumb: landscape ? true : null,
            inheritThumb: isEpisodeList ? !useEpisodeImages : undefined,
            showUnplayedIndicator: section.Type !== 'RecentlyAdded',
            showChildCountIndicator: true,
            context: 'home',
            overlayText: false,
            centerText: true,
            overlayPlayButton: true,
            showDetailsMenu: true,
            allowBottomPadding: false,
            cardLayout: false,
            showTitle: true,
            showParentTitle: true,
            showYear: true,
            lazy: true,
            lines: 2
        });
    }

    /** Illustrated tiles of genres and studios, inspired by Seerr. */
    function renderTiles(tiles, section, ctx) {
        const shape = getShape(section);

        return tiles.map(function (tile, index) {
            const kindClass = tile.kind === 'genre' ? 'bhs-genreTile' : 'bhs-studioTile';
            const style = tile.tone ? ' style="--bhs-tone-dark:#' + tile.tone[0] + ';--bhs-tone-light:#' + tile.tone[1] + '"' : '';
            const imageClass = 'bhs-tile-image' + (tile.isLogo ? ' bhs-tile-logo' : '');
            // Studio images are logos, which replace the name like in Seerr
            const showName = tile.kind === 'genre' || !tile.imageUrl;

            return '<div class="card ' + shape + 'Card card-hoverable bhs-tile ' + kindClass + '" data-index="' + index
                + '" data-id="' + escapeHtml(tile.item.Id) + '" data-serverid="' + escapeHtml(ctx.serverId)
                + '" data-type="' + escapeHtml(tile.item.Type) + '" data-isfolder="true">'
                + '<div class="cardBox"><div class="cardScalable">'
                + '<div class="cardPadder cardPadder-' + shape + '"></div>'
                + '<a href="' + escapeHtml(tile.url) + '" class="cardImageContainer cardContent bhs-tile-content'
                + (tile.imageUrl ? '' : ' bhs-tile-noImage') + '"' + style + ' title="' + escapeHtml(tile.name) + '">'
                + (tile.imageUrl ? '<div class="' + imageClass + ' lazy" data-src="' + escapeHtml(tile.imageUrl) + '"></div>' : '')
                + '<div class="bhs-tile-tint"></div>'
                + '<div class="bhs-tile-overlay"></div>'
                + (showName ? '<div class="bhs-tile-name">' + escapeHtml(tile.name) + '</div>' : '')
                + '</a>'
                + '</div></div></div>';
        }).join('');
    }

    function getSectionHeaderHtml(title, url) {
        let html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';
        if (url && !isTvLayout()) {
            html += '<a is="emby-linkbutton" href="' + escapeHtml(url) + '" class="more button-flat button-flat-mini sectionTitleTextButton">'
                + '<h2 class="sectionTitle sectionTitle-cards">' + escapeHtml(title) + '</h2>'
                + '<span class="material-icons chevron_right" aria-hidden="true"></span>'
                + '</a>';
        } else {
            html += '<h2 class="sectionTitle sectionTitle-cards">' + escapeHtml(title) + '</h2>';
        }
        return html + '</div>';
    }

    /**
     * Renders a section like the native ones: the items container fetches and renders its items when resumed,
     * hides the section when there are none, and refreshes itself on the monitored events.
     */
    function renderSection(element, section, ctx) {
        const type = SECTION_TYPES[section.Type];
        const monitor = type.monitor ? ' data-monitor="' + type.monitor + '"' : '';

        element.classList.add('hide');
        element.innerHTML = getSectionHeaderHtml(getSectionTitle(section, ctx.t), getTitleUrl(section, ctx))
            + '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">'
            + '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x"' + monitor + '></div>'
            + '</div>';

        const itemsContainer = element.querySelector('.itemsContainer');
        itemsContainer.fetchData = function () {
            return type.fetch(section, ctx).catch(function (error) {
                console.error(LOG_PREFIX, 'Failed to load the section', section, error);
                return [];
            });
        };
        itemsContainer.getItemsHtml = function (items) {
            return type.render(items, section, ctx);
        };
        itemsContainer.parentContainer = element;
    }

    function renderSections(elem, apiClient, user, userSettings, settings, t) {
        const sections = (settings.Sections || []).filter(function (section) {
            return SECTION_TYPES[section.Type];
        });
        const ctx = {
            apiClient: apiClient,
            userId: user.Id || apiClient.getCurrentUserId(),
            serverId: apiClient.serverId(),
            userSettings: userSettings || {},
            t: t,
            userViews: []
        };

        // The user views are only needed to link the collections section to the collections library
        const needsUserViews = sections.some(function (section) {
            return section.Type === 'Collections';
        });
        const userViewsPromise = needsUserViews
            ? getJson(ctx, 'UserViews', { UserId: ctx.userId }).then(toItems).catch(function () {
                return [];
            })
            : Promise.resolve([]);

        return userViewsPromise.then(function (userViews) {
            ctx.userViews = userViews;

            // Same structure as the native sections, so themes and plugins relying on it keep working
            elem.innerHTML = sections.map(function (section, index) {
                return '<div class="verticalSection section' + index + ' bhs-section bhs-section-' + section.Type + '"></div>';
            }).join('');
            elem.classList.add('homeSectionsContainer');

            sections.forEach(function (section, index) {
                renderSection(elem.children[index], section, ctx);
            });

            // Lets the custom elements upgrade (like the native sections), then loads every section
            return new Promise(function (resolve) {
                setTimeout(resolve, 0);
            });
        }).then(function () {
            const containers = elem.querySelectorAll('.itemsContainer');
            return Promise.all(Array.prototype.map.call(containers, function (container) {
                return container.resume ? container.resume({ refresh: true }) : null;
            }));
        });
    }

    /**
     * Replacement of the `loadSections` function of the web client.
     * @param {Function} originalLoadSections The original function, used if the plugin fails.
     * @param {IArguments} args The arguments: sections element, API client, user and user settings.
     */
    function loadSections(originalLoadSections, args) {
        const elem = args[0];
        const apiClient = args[1];
        const user = args[2];
        const userSettings = args[3];

        return getSettings(apiClient).then(function (settings) {
            return loadTranslator(apiClient, settings).then(function (t) {
                return renderSections(elem, apiClient, user, userSettings, settings, t);
            });
        }).catch(function (error) {
            console.error(LOG_PREFIX, 'Failed to render the home sections, using the default ones', error);
            return originalLoadSections.apply(null, args);
        });
    }

    window.BetterHomeSections = {
        loadSections: loadSections,
        // Shared with the configuration page
        sectionTypes: SECTION_TYPES,
        getSettings: getSettings,
        resolveLanguage: resolveLanguage,
        loadTranslator: loadTranslator,
        getSectionTitle: getSectionTitle,
        getItemTypes: getItemTypes,
        isMusicLibrary: isMusicLibrary
    };
})();
