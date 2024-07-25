class MELP {
    constructor(corpora_host, corpora_token, melp_corpus_id, plugin_url, iiif_prefix, github_prefix) {
        this.host = corpora_host
        this.token = corpora_token
        this.corpus_id = melp_corpus_id
        this.path = window.location.pathname
        this.params = this.get_request_parameters()
        this.plugin_url = plugin_url
        this.iiif_prefix = iiif_prefix
        this.github_prefix = github_prefix
        this.breakpoints = {
            mobile: 767
        }
        this.medium = this.determine_medium()
        this.nav = null
        this.advanced_search = null
        this.letter_viewer = null

        // 'this' helper
        let sender = this

        // NAV
        let nav_container = jQuery('#top-container')
        if (nav_container.length) this.load_template(
            nav_container,
            'nav.html',
            function() {
                sender.nav = new Nav(sender, nav_container)
                sender.adjust_for_screen_size()
            },
            true
        )

        // BROWSE BY MENU
        let browse_by_container = jQuery('#browse-by-container')
        if (browse_by_container.length) this.load_template(
            browse_by_container,
            'browse_by.html',
            function() {
                let browser = new Browser(melp)
            },
            true)

        // START HERE
        let start_here_container = jQuery('#start-here-container')
        if (start_here_container.length) this.load_template(
                start_here_container,
                'start_here.html',
                function() {
                    jQuery('.letter-carousel').each(function() {
                        let carousel = new LetterCarousel(sender, jQuery(this))
                    })
                },
                true
            )

        // PROJECT UPDATES
        let project_updates_container = jQuery('#project-updates-container')
        if (project_updates_container.length) this.load_template(
            project_updates_container,
            'project_updates.html',
            function() {
                let updates = new ProjectUpdates(sender, jQuery('#project-updates'))
            }
        )

        // LETTER VIEWER AND ADVANCED SEARCH
        let advanced_search_container = jQuery('#advanced-search-container')
        if (advanced_search_container.length) {
            if (this.params.path.length) {
                let letter_id = this.params.path[0].replaceAll('%20', ' ')
                advanced_search_container.addClass('letter-viewer-container')
                this.load_template(
                    advanced_search_container,
                    'letter_viewer.html',
                    function() {
                        sender.letter_viewer = new LetterViewer(sender, letter_id)
                        sender.adjust_for_screen_size()
                    },
                    true
                )
            }
            else {
                this.load_template(
                    advanced_search_container,
                    'advanced_search.html',
                    function () {
                        sender.advanced_search = new AdvancedSearch(sender)
                        sender.adjust_for_screen_size()
                    },
                    true
                )
            }
        }

        // BROWSER
        let browse_container = jQuery('#browse-container')
        if (browse_container.length) {

        }

        // FOOTER
        let footer_container = jQuery('#footer-container')
        if (footer_container.length) this.load_template(footer_container, 'footer.html', function() { sender.adjust_for_screen_size() }, true)

        jQuery(window).on('resize', function() { sender.adjust_for_screen_size() })
    }

    make_request(path, type, params={}, callback, inject_host=true, spool=false, spool_records=[]) {
        let url = path
        if (inject_host) url = `${this.host}${path}`

        let req = {
            type: type,
            url: url,
            dataType: 'json',
            crossDomain: true,
            data: params,
            success: callback
        }

        if (this.token) {
            let sender = this
            req['beforeSend'] = function(xhr) { xhr.setRequestHeader("Authorization", `Token ${sender.token}`) }
        }

        if (spool) {
            let corpora_instance = this;
            req.success = function(data) {
                if (
                    data.hasOwnProperty('records') &&
                    data.hasOwnProperty('meta') &&
                    data.meta.hasOwnProperty('has_next_page') &&
                    data.meta.hasOwnProperty('page') &&
                    data.meta.hasOwnProperty('page_size') &&
                    data.meta.has_next_page
                ) {
                    let next_params = Object.assign({}, params);
                    next_params.page = data.meta.page + 1;
                    next_params['page-size'] = data.meta.page_size;

                    corpora_instance.make_request(
                        path,
                        type,
                        next_params,
                        callback,
                        inject_host,
                        spool,
                        spool_records.concat(data.records)
                    )
                } else {
                    data.records = spool_records.concat(data.records);
                    callback(data);
                }
            }
        }

        return jQuery.ajax(req)
    }

    random_index(length) {
        return Math.floor(Math.random() * length)
    }

    count_instances(a_string, instance) {
        return a_string.split(instance).length
    }

    inject_iiif_info(img, callback) {
        jQuery.getJSON(`${img.data('iiif-identifier')}/info.json`, {}, function(info) {
            img.data('fullwidth', info.width)
            img.data('fullheight', info.height)
            if (!img.data('region'))
                img.data('region', `${parseInt(info.width / 2) - 100},${parseInt(info.height / 2) - 100},200,200`)
            callback()
        })
    }

    render_image(img, size, region_only=true) {
        let iiif_src
        let width = size
        let height = size

        if (img.data('display-restriction') === 'No Image') {
            iiif_src = `${this.plugin_url}/img/image-unavailable.png`
            if (!region_only) {
                width = 200
                height = 200
            }
        } else {
            if (img.data('display-restriction') === 'Thumbnail Only' && !region_only) {
                region_only = true
                width = 200
                height = 200
            }

            if (region_only) {
                iiif_src = `${img.data('iiif-identifier')}/${img.data('region')}/${size},${size}/0/default.png`
            } else {
                if (width > img.data('fullwidth')) width = img.data('fullwidth')
                iiif_src = `${img.data('iiif-identifier')}/full/${width},/0/default.png`
                let ratio = width / img.data('fullwidth')
                height = parseInt(ratio * img.data('fullheight'))
                img.css('filter', 'brightness(2)')
                img.on('load', function () {
                    img.css('filter', 'brightness(1.1)')
                })
            }
        }

        img.attr('src', iiif_src)
        img.css('width', `${width}px`)
        img.css('height', `${height}px`)
        img.data('loaded', true)
    }
    
    render_metadata(artwork, style='vertical') {
        if (style === 'vertical') {
            return `
              <dl>
                <dt>Year:</dt><dd>${artwork.year}</dd>
                ${artwork.collection && !artwork.anonymize_collector ? `<dt>Collection:</dt><dd>${artwork.collection.label}</dd>` : ''}
                ${artwork.anonymize_collector ? `<dt>Collection:</dt><dd>Private Collection</dd>` : ''}
                <dt>Medium:</dt><dd>${artwork.medium}</dd>
                <dt>Surface:</dt><dd>${artwork.surface}</dd>
                <dt>Size:</dt><dd>${artwork.size_inches}</dd>
              </dl>
              <a class="mt-2" href="/artwork/${artwork.id}/" target="_blank">See more...</a>
            `
        } else if (style === 'horizontal') {
            return `
                <div class="row">
                  <div class="col-md-6">
                    <dl>
                      <dt>Year:</dt><dd>${artwork.year}</dd>
                      <dt>Medium:</dt><dd>${artwork.medium}</dd>
                      <dt>Surface:</dt><dd>${artwork.surface}</dd>
                    </dl>
                  </div>
                  <div class="col-md-6 d-flex flex-column">
                    <dl style="flex: 1;">
                      ${artwork.collection && !artwork.anonymize_collector ? `<dt>Collection:</dt><dd>${artwork.collection.label}</dd>` : ''}
                      ${artwork.anonymize_collector ? `<dt>Collection:</dt><dd>Private Collection</dd>` : ''}
                      <dt>Size:</dt><dd>${artwork.size_inches}</dd>
                    </dl>
                    <div class="w-100">
                      <a class="float-right" href="/artwork/${artwork.id}/" target="_blank">See more...</a>
                    </div>
                  </div>
                </div>
            `
        } else if (style === 'full') {
            let tags = []
            artwork.tags.forEach(tag => {
                let [key, value] = tag.label.split(': ')
                tags.push(`<dt>${key}:</dt><dd>${value}</dd>`)
            })

            let exhibits = []
            artwork.exhibits.forEach(exhibit => {
                exhibits.push(`<p>${exhibit.label}</p>`)
            })

            let prizes = []
            artwork.prizes.forEach(prize => {
                prizes.push(`<p><i>${prize.name}</i> awarded at ${prize.exhibit}</p>`)
            })

            return `
                <dl>
                  ${artwork.caption ? `<dt>Caption:</dt><dd>${artwork.caption}</dd>` : ''}
                  ${artwork.alt_title ? `<dt>Alternate Title</dt><dd>${artwork.alt_title}</dd>` : ''}
                  <dt>Creator:</dt><dd>${artwork.artists[0].label}</dd>
                  <dt>Year:</dt><dd>${artwork.year}</dd>
                  ${artwork.location ? `<dt>Depicted Place:</dt><dd><a href="/?filter_label=Depicted Place&param=f_location.id&value_label=${artwork.location.label}&value=${artwork.location.id}">${artwork.location.label}</a></dd>` : ''}
                  ${artwork.edition ? `<dt>Edition</dt><dd>${artwork.edition}</dd>` : ''}
                  ${tags.join('\n')}
                  <dt>Medium:</dt><dd><a href="/?filter_label=Medium&param=f_medium&value_label=${artwork.medium}&value=${artwork.medium}">${artwork.medium}</a></dd>
                  <dt>Surface:</dt><dd><a href="/?filter_label=Surface&param=f_surface&value_label=${artwork.surface}&value=${artwork.surface}">${artwork.surface}</a></dd>
                  <dt>Size:</dt><dd>${artwork.size_inches}</dd>
                  ${artwork.inscriptions ? `<dt>Inscriptions</dt><dd>${artwork.inscriptions}</dd>` : ''}
                  ${artwork.collection && !artwork.anonymize_collector ? `<dt>Collection:</dt><dd><a href="/?filter_label=Collection&param=f_collection.id&value_label=${artwork.collection.label}&value=${artwork.collection.id}">${artwork.collection.label}</a></dd>` : ''}
                  ${artwork.anonymize_collector ? `<dt>Collection:</dt><dd><a href="/?filter_label=Collection&param=f_anonymize_collector&value_label=Private Collection&value=true">Private Collection</a></dd>` : ''}
                </dl>
                
                ${exhibits.length ? `
                    <h2>Exhibits</h2>
                    ${exhibits.join('\n')}
                ` : ''}
                
                ${prizes.length ? `
                    <h2>Prizes</h2>
                    ${prizes.join('\n')}
                ` : ''}
            `
        }
    }

    get_request_parameters() {
        let params = {
            path: [],
            get: new URLSearchParams(window.location.search)
        }

        // check for url path parameters
        let path_parts = window.location.pathname.split('/');
        if (path_parts.length > 2) {
            for (let p = 2; p < path_parts.length; p++) {
                if (path_parts[p].length) {
                    params.path.push(path_parts[p])
                }
            }
        }

        return params
    }

    clean_elementor_widget(element) {
        let elementor_widgets = element.children('.elementor-widget-container')
        if (elementor_widgets.length) {
            elementor_widgets.each(function() {
                let widget = jQuery(this)
                let style = widget.children('style')

                style.each(function() { jQuery(this).remove() })
                widget.contents().appendTo(element)
                widget.remove()
            })
        }
    }

    load_template(element, template, callback=null, prepend_url=false) {
        let sender = this
        element.load(`${this.plugin_url}templates/${template}`, function() {
            if (prepend_url) {
                element.find('[data-url-prepend-attr]').each(function() {
                    let el = jQuery(this)
                    let attr = el.data('url-prepend-attr')
                    let val = el.attr(attr)

                    el.attr(attr, `${sender.plugin_url}${val}`)
                })
            }

            if (callback) callback()
        })
    }

    determine_medium() {
        let screen_size = window.innerWidth
        return screen_size > this.breakpoints.mobile ? 'desktop' : 'mobile'
    }

    adjust_for_screen_size() {
        let last_medium = this.medium
        this.medium = this.determine_medium()

        let nav_search_button = jQuery('#nav-search-button')

        if (this.medium === 'desktop' && last_medium === 'mobile') {
            // fix nav
            nav_search_button.html('Search Letters')
            if (this.path !== '/') this.nav.nav_search.appendTo(this.nav.nav_container)

            this.nav.nav_menu.appendTo(this.nav.nav_container)

            // fix letter carousel thumbnails
            jQuery('.letter-carousel-thumbnail').each(function() {
                let thumb = jQuery(this)
                let src = thumb.attr('src')
                thumb.attr('src', src.replace('square/330,', 'full/,200'))
            })

            // fix advanced search
            if (this.path === '/letters/') {
                let search_bar = jQuery('#adv-search-bar')
                let search_type_bar = jQuery('#adv-search-type-bar').detach()
                let search_filters = jQuery('#adv-search-filter').detach()

                jQuery('#adv-search-box').prependTo(search_bar)
                search_bar.after(search_type_bar)
                search_filters.prependTo(jQuery('#adv-search-filter-and-results'))
                jQuery('#adv-search-button').html('Search')
                jQuery('#adv-search-modal-search-and-filter-div').empty()
                this.advanced_search.build_filter_boxes()
            }

            // fix letter viewer
            if (this.letter_viewer) {

            }
        }
        else if (this.medium === 'mobile') {
            // fix nav
            this.nav.nav_menu.appendTo(this.nav.hamburger_nav_container)
            nav_search_button.html('Search')
            if (this.path !== '/') {
                this.nav.nav_search.appendTo(this.nav.hamburger_search_container)
            }

            // fix letter carousel thumbnails
            jQuery('.letter-carousel-thumbnail').each(function() {
                let thumb = jQuery(this)
                let src = thumb.attr('src')
                thumb.attr('src', src.replace('full/,200', 'square/330,'))
            })

            // fix advanced search
            if (this.path === '/letters/') {
                let search_and_filter_div = jQuery('#adv-search-modal-search-and-filter-div')
                if (search_and_filter_div.length && !search_and_filter_div.children().length) {
                    jQuery('#adv-search-box').appendTo(search_and_filter_div)
                    jQuery('#adv-search-type-bar').appendTo(search_and_filter_div)
                    jQuery('#adv-search-filter').appendTo(search_and_filter_div)
                    jQuery('#adv-search-button').html(`<img src="${this.plugin_url}img/icon_filter.png"> Search & Filter`)
                    search_and_filter_div.append('<div style="height: 100vh;">&nbsp;</div>')
                    if (jQuery('.select2').length) this.advanced_search.destroy_filter_boxes()
                }
            }

            // fix letter viewer
            if (this.letter_viewer) {

            }
        }

    }
}

class Nav {
    constructor(melp_instance, element) {
        this.melp = melp_instance
        this.element = element
        this.nav_container = jQuery('#nav-container')
        this.nav_search = jQuery('#nav-search')
        this.nav_search_box = jQuery('#nav-search-bar')
        this.nav_search_button = jQuery('#nav-search-button')
        this.nav_title = jQuery('#nav-title')
        this.nav_menu = jQuery('#nav-menu')
        this.masthead = jQuery('#masthead')
        this.masthead_title_and_description = jQuery('#masthead-title-and-description')
        this.masthead_project_description = jQuery('#masthead-project-description')
        this.masthead_byline = jQuery('#masthead-byline')

        this.hamburger_modal = jQuery('#hamburger-modal')
        this.hamburger_open_button = jQuery('#hamburger-open-button')
        this.hamburger_close_button = jQuery('#hamburger-close-button')
        this.hamburger_title_container = jQuery('#hamburger-title-container')
        this.hamburger_search_container = jQuery('#hamburger-search-container')
        this.hamburger_nav_container = jQuery('#hamburger-nav-container')
        this.hamburger_footer_container = jQuery('#hamburger-footer-container')

        let sender = this

        sender.nav_search_box.keyup(function(e) {
            if (e.key === 'Enter' && sender.nav_search_box.val().length) {
                window.location.href = `/letters/?search=${sender.nav_search_box.val()}`
            }
        })
        sender.nav_search_button.click(function() {
            if (sender.nav_search_box.val().length) {
                window.location.href = `/letters/?search=${sender.nav_search_box.val()}`
            }
        })

        this.hamburger_open_button.click(function() {
            sender.open_hamburger()
        })
        this.hamburger_close_button.click(function() {
            sender.close_hamburger()
        })

        if (sender.melp.path === '/') {
            // add homepage class
            sender.nav_container.addClass('homepage')

            // cleanup
            sender.melp.clean_elementor_widget(sender.masthead_project_description)
            sender.melp.clean_elementor_widget(sender.masthead_byline)

            if (sender.masthead.length && sender.nav_title.length && sender.nav_search.length && sender.masthead_project_description.length && sender.masthead_byline.length) {
                sender.nav_title.appendTo(sender.masthead_title_and_description)
                sender.masthead_project_description.contents().appendTo(sender.masthead_title_and_description)

                sender.masthead.append(`
                    <a id="masthead-about-button" href="/about">About the Project</a>
                `)

                sender.masthead_byline.contents().appendTo(sender.masthead)
                sender.nav_search.appendTo(sender.masthead)
            }
        } else if (sender.melp.path.startsWith('/about')) {
            jQuery('#nav-menu-about').addClass('current')
        } else if (sender.melp.path.startsWith('/letters')) {
            jQuery('#nav-menu-current').addClass('current')
            if (sender.melp.path === '/letters/') {
                sender.nav_container.addClass('search')
                sender.nav_search.hide()
            }
        } else if (sender.melp.path.startsWith('/locations')) {
            jQuery('#nav-menu-locations').addClass('current')
        }

        jQuery('.delete-after-load').remove()
    }

    open_hamburger() {
        this.hamburger_modal.css('display', 'flex')
        this.nav_title.prependTo(this.hamburger_title_container)
        jQuery('#footer-copyright').appendTo(this.hamburger_footer_container)
        if (this.melp.path === '/') this.nav_search.appendTo(this.hamburger_search_container)
    }

    close_hamburger() {
        this.hamburger_modal.css('display', 'none')

        if (this.melp.path === '/') {
            this.nav_title.prependTo(this.masthead_title_and_description)
            this.nav_search.appendTo(this.masthead)
        } else {
            this.nav_title.prependTo(this.nav_container)
        }
    }
}


class Browser {
    constructor(melp_instance) {
        this.melp = melp_instance
        this.tray = jQuery('#browse-by-tray')
        this.sort_box = jQuery('#browse-by-sort-box')
        this.index_box = jQuery('#browse-by-index')
        this.stats = {
            PERSON: {},
            PLACE: {},
            WORK: {},
            ORG: {}
        }
        this.loaded = false

        let sender = this

        jQuery('.browse-by-pill').click(function() {
            let pill = jQuery(this)
            let entity_type = pill.data('entity_type')

            if (Object.keys(sender.stats).includes(entity_type)) {
                if (sender.loaded) sender.populate_index(entity_type)
                else sender.load_stats(entity_type)
            }
        })

        this.sort_box.change(function() {
            sender.sort_index()
        })
    }

    load_stats(index_to_populate=null) {
        let sender = this
        sender.melp.make_request(
            `/api/corpus/${sender.melp.corpus_id}/Letter/`,
            'GET',
            {
                'page-size': 0,
                'a_terms_index': 'entities_mentioned.xml_id,entities_mentioned.entity_type',
                'a_terms_author': 'author.xml_id',
                'a_terms_recipient': 'recipient.xml_id',
                'a_terms_repo': 'repository.id'
            },
            function(stat_aggs) {
                if (stat_aggs.meta && stat_aggs.meta.aggregations) {
                    let index_agg = stat_aggs.meta.aggregations.index
                    let author_agg = stat_aggs.meta.aggregations.author
                    let recip_agg = stat_aggs.meta.aggregations.recipient
                    let repo_agg = stat_aggs.meta.aggregations.repo

                    Object.keys(index_agg).forEach(index_key => {
                        let [xml_id, entity_type] = index_key.split('|||')
                        sender.stats[entity_type][xml_id] = {count: index_agg[index_key]}
                    })
                    Object.keys(author_agg).forEach(auth_key => {
                        if (!(auth_key in sender.stats.PERSON)) sender.stats.PERSON[auth_key] = { count: 0 }
                        sender.stats.PERSON[auth_key]['count'] += author_agg[auth_key]
                    })
                    Object.keys(recip_agg).forEach(recip_key => {
                        if (!(recip_key in sender.stats.PERSON)) sender.stats.PERSON[recip_key] = { count: 0 }
                        sender.stats.PERSON[recip_key]['count'] += recip_agg[recip_key]
                    })
                    Object.keys(repo_agg).forEach(repo_key => {
                        sender.stats.ORG[repo_key] = { count: repo_agg[repo_key] }
                    })

                    sender.melp.make_request(
                        `/api/corpus/${sender.melp.corpus_id}/Entity/`,
                        'GET',
                        {'page-size': 1000, 's_name': 'asc'},
                        function(ents) {
                            if (ents.records) {
                                ents.records.forEach(ent => {
                                    if ((ent.entity_type in sender.stats) && (ent.xml_id in sender.stats[ent.entity_type])) {
                                        sender.stats[ent.entity_type][ent.xml_id]['name'] = ent.name
                                    } else if ((ent.entity_type in sender.stats) && (ent.id in sender.stats[ent.entity_type])) {
                                        sender.stats[ent.entity_type][ent.id]['name'] = ent.name
                                    }
                                })

                                sender.loaded = true

                                if (index_to_populate) {
                                    sender.populate_index(index_to_populate)
                                }
                            }
                        }
                    )
                }
            }
        )
    }

    populate_index(entity_type) {
        this.index_box.empty()
        this.tray.removeClass('open')
        setTimeout(() => {
            if (this.loaded && (entity_type in this.stats)) {
                Object.keys(this.stats[entity_type]).forEach(xml_id => {
                    let entity = this.stats[entity_type][xml_id]
                    this.index_box.append(`
                        <div class="browse-by-entity" data-name="${entity.name}" data-freq="${entity.count}">
                          <a href="/letters/?${entity_type}=${xml_id}" target="_blank">(${entity.count}) ${entity.name}</a>
                        </div>
                    `)
                })
                this.sort_index()
                this.tray.addClass('open')
            }
        }, 1000)
    }

    sort_index() {
        let sort_by = this.sort_box.val()
        this.index_box.find('.browse-by-entity').sort(function (a, b) {
            let entity_a_attr = sort_by === 'alpha' ? jQuery(a).data('name') : jQuery(a).data('freq')
            let entity_b_attr = sort_by === 'alpha' ? jQuery(b).data('name') : jQuery(b).data('freq')

            if (entity_a_attr < entity_b_attr) {
                if (sort_by === 'alpha') return -1
                else return 1
            }
            if (entity_a_attr > entity_b_attr) {
                if (sort_by === 'alpha') return 1
                else return -1
            }
            return 0
        })
        .appendTo(this.index_box)
    }
}


class LetterCarousel {
    constructor(melp_instance, element) {
        this.melp = melp_instance
        this.element = element
        this.search_criteria = {
            s_date_composed: 'asc'
        }
        this.identifier = `letter-carousel-${element.data('identifier')}`
        let sender = this

        for (let a = 0; a < element[0].attributes.length; a++) {
            let attr = element[0].attributes[a].name
            let val = element[0].attributes[a].value
            if (attr.startsWith('data-search_')) sender.search_criteria[attr.replace('data-search_', '')] = val
        }

        console.log(sender.search_criteria)

        this.melp.make_request(
            `/api/corpus/${sender.melp.corpus_id}/Letter/`,
            'GET',
            sender.search_criteria,
            function(data) {
                if (data.records) {
                    let html = `<div id="${sender.identifier}-slider" class="letter-carousel-slider">`
                    if (element.data('skip_first') && data.records.length) data.records.shift()

                    let image_size_specifier = 'full/,200'
                    if (sender.melp.screen_size <= sender.melp.breakpoints.mobile) image_size_specifier = 'square/330,'

                    data.records.forEach((letter, letter_index) => {
                        let image_url = `${sender.melp.iiif_prefix}%2F${letter.identifier}%2F${letter.images[0]}/${image_size_specifier}/0/default.jpg`
                        let letter_url = `/letters/${letter.identifier}`
                        html += `
                            <div id="${sender.identifier}-letter-${letter_index}" class="letter-carousel-item" data-letter-identifier="${letter.identifier}">
                              <a class="letter-carousel-thumbnail-link" href="${letter_url}"><img src="${image_url}" class="letter-carousel-thumbnail"></a>
                              <a href="${letter_url}"><label class="letter-carousel-label">${letter.title}</label></a>
                            </div>
                        `
                    })

                    html += `</div><div id="${sender.identifier}-pager" class="letter-carousel-pager"></div></div>`
                    element.append(html)

                    let pager = jQuery(`#${sender.identifier}-pager`)
                    let letters_visible = Math.max(parseInt(element.width() / 625), 1)
                    let num_pages = Math.ceil(data.records.length / letters_visible)

                    for (let page_index = 0; page_index < num_pages; page_index++) {
                        let icon = 'icon_pager.png'
                        if (page_index === 0) icon = 'icon_pager_current.png'

                        pager.append(`
                            <img src="${sender.melp.plugin_url}img/${icon}" class="letter-carousel-page" data-letter-index="${page_index * letters_visible}" />
                        `)
                    }

                    jQuery(`.letter-carousel-page`).click(function() {
                        let page = jQuery(this)
                        let pages = jQuery('.letter-carousel-page')
                        let letter_index = page.data('letter-index')
                        let letter = jQuery(`#${sender.identifier}-letter-${letter_index}`)
                        let slider = jQuery(`#${sender.identifier}-slider`)
                        let slider_edge = slider.position().left
                        let letter_edge = letter.position().left
                        let current_scroll = slider.scrollLeft()
                        let direction = 'right'
                        let scroll_difference = letter_edge - slider_edge
                        if (slider_edge > letter_edge) {
                            scroll_difference = slider_edge - letter_edge
                            direction = 'left'
                        }

                        if (direction === 'right') slider.scrollLeft(current_scroll + scroll_difference)
                        else slider.scrollLeft(current_scroll - scroll_difference)

                        pages.attr('src', `${sender.melp.plugin_url}img/icon_pager.png`)
                        page.attr('src', `${sender.melp.plugin_url}img/icon_pager_current.png`)
                    })
                }
            }
        )
    }
}


class ProjectUpdates {
    constructor(melp_instance, element) {
        this.melp = melp_instance
        this.element = element

        fetch('/feed')
            .then(response => response.text())
            .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
            .then(data => {
                let feed = jQuery(data)
                let items = feed.find('item')

                if (items.length) {
                    if (items.length > 1) this.render_update(jQuery(items[items.length - 2]))
                    this.render_update(jQuery(items[items.length - 1]))
                }
            })
    }

    render_update(item) {
        let title = item.find('title').text()
        let link = item.find('link').text()
        let description = jQuery(new window.DOMParser().parseFromString('<div>' + item.find('description').text() + '</div>', 'text/xml'))
        let featured_image = description.find('.webfeedsFeaturedVisual')
        let image_source = featured_image.attr('src')
        let summary = description.text().replace('[…]', '…')

        this.element.append(`
            <div class="project-update">
                <div class="project-update-image-wrapper">
                  <img src="${image_source}" class="project-update-image">
                </div>
                
                <h3 class="project-update-title">${title}</h3>
                <p class="project-update-description">${summary}</p>
                <a class="project-read-more" href="${link}" target="_blank">Learn More</a>
            </div>
        `)
    }
}


class AdvancedSearch {
    constructor(melp_instance) {
        this.melp = melp_instance
        this.criteria = {
            'page': 1,
            'page-size': 100,
            's_date_composed': 'asc',
            'a_terms_entities': 'entities_mentioned.xml_id,entities_mentioned.entity_type',
            'a_terms_authors': 'author.xml_id',
            'a_terms_recipients': 'recipient.xml_id',
            'a_terms_repos': 'repository.id',
            //'es_debug': 'y'
        }
        this.next_page_threshold = 0
        this.resetting_filters = false
        this.date_range = {
            min: {
                year: 1791,
                month: 12,
                day: 7
            },
            max: {
                year: 1848,
                month: 7,
                day: 1
            }
        }
        this.filters = {
            PERSON: {
                control_name: 'people',
                identifier: 'xml_id',
                parameters: ['t_author.xml_id|', 't_recipient.xml_id|', 't_entities_mentioned.xml_id|'],
                placeholder: 'Select a person...',
                active: []
            },
            WORK: {
                control_name: 'works',
                identifier: 'xml_id',
                parameters: ['f_entities_mentioned.xml_id|'],
                placeholder: 'Select a work...',
                active: []
            },
            PLACE: {
                control_name: 'places',
                identifier: 'xml_id',
                parameters: ['f_entities_mentioned.xml_id|'],
                placeholder: 'Select a place...',
                active: []
            },
            ORG: {
                control_name: 'repos',
                identifier: 'id',
                parameters: ['f_repository.id|'],
                placeholder: 'Select a repository...',
                active: []
            }
        }
        this.initial_filter = null

        this.search_box = jQuery('#adv-search-box')
        this.search_modal = jQuery('#adv-search-modal')

        let search_button = jQuery('#adv-search-button')
        let apply_filters_button = jQuery('#adv-search-modal-apply-button')
        let modal_close_button = jQuery('#adv-search-modal-close-button')
        let sort_select_box = jQuery('#adv-search-sort-box')

        let sender = this

        this.result_watcher = new IntersectionObserver(function(entries) {
            entries.map(entry => {
                if (entry.isIntersecting) {
                    let result = jQuery(`#${entry.target.id}`)
                    let result_id = result.data('id')

                    // increment results scrolled, act accordingly
                    sender.results_scrolled += 1

                    // update count
                    let result_count = result.data('count')
                    let current_result = jQuery(`#adv-search-current-result`)
                    current_result.html(result_count)
                    current_result.data('id', result_id)

                    if (sender.next_page_threshold && result_count >= sender.next_page_threshold) {
                        sender.next_page_threshold = 0
                        sender.criteria.page += 1
                        sender.load_results()
                        console.log(`page ${sender.criteria.page} threshold crossed`)
                    }
                }
            })
        })

        // SEARCH BOX
        if (this.melp.params.get.get('search')) this.search_box.val(this.melp.params.get.get('search'))
        this.search_box.keyup(function(e) {
            if (e.key === 'Enter') {
                sender.load_results(true)
                sender.search_modal.css('display', 'none')
            }
        })
        search_button.click(function() {
            if (sender.melp.determine_medium() === 'desktop') sender.load_results(true)
            else sender.show_search_modal()
        })
        apply_filters_button.click(function() {
            sender.load_results(true)
            sender.search_modal.css('display', 'none')
        })
        modal_close_button.click(function() {
            sender.hide_search_modal()
        })
        sort_select_box.change(function() {
            let sorter = jQuery(this)
            sender.criteria.s_date_composed = sorter.val()
            sender.load_results(true)
        })

        // INITIAL FILTERS
        Object.keys(this.filters).forEach(entity_type => {
            if (this.melp.params.get.get(entity_type)) {
                this.filters[entity_type]['initial'] = this.melp.params.get.get(entity_type)
                this.initial_filter = entity_type
            }
        })

        // DATE FILTER
        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Letter/`,
            'GET',
            {
                a_min_mindate: 'date_composed',
                a_max_maxdate: 'date_composed',
                r_date_composed: '1-1-1768to1860-01-01',
                'page-size': 0},
            function(data) {
                if (data.meta && data.meta.aggregations) {
                    let min = new Date(data.meta.aggregations.mindate)
                    let max = new Date(data.meta.aggregations.maxdate)
                    let from_year_box = jQuery('#adv-search-date-from-year-box')
                    let from_month_box = jQuery('#adv-search-date-from-month-box')
                    let from_day_box = jQuery('#adv-search-date-from-day-box')
                    let to_year_box = jQuery('#adv-search-date-to-year-box')
                    let to_month_box = jQuery('#adv-search-date-to-month-box')
                    let to_day_box = jQuery('#adv-search-date-to-day-box')

                    sender.date_range.min.year = min.getUTCFullYear()
                    sender.date_range.min.month = min.getUTCMonth() + 1
                    sender.date_range.min.day = min.getUTCDate()
                    sender.date_range.max.year = max.getUTCFullYear()
                    sender.date_range.max.month = max.getUTCMonth() + 1
                    sender.date_range.max.day = max.getUTCDate()
                    
                    from_year_box.attr('placeholder', sender.date_range.min.year)
                    from_month_box.attr('placeholder', sender.date_range.min.month)
                    from_day_box.attr('placeholder', sender.date_range.min.day)
                    to_year_box.attr('placeholder', sender.date_range.max.year)
                    to_month_box.attr('placeholder', sender.date_range.max.month)
                    to_day_box.attr('placeholder', sender.date_range.max.day)

                    jQuery('#adv-search-dates-apply-button').click(function() {
                        let from_year = from_year_box.val() ? from_year_box.val() : sender.date_range.min.year
                        let from_month = from_month_box.val() ? from_month_box.val() : sender.date_range.min.month
                        let from_day = from_day_box.val() ? from_day_box.val() : sender.date_range.min.day
                        let to_year = to_year_box.val() ? to_year_box.val() : sender.date_range.max.year
                        let to_month = to_month_box.val() ? to_month_box.val() : sender.date_range.max.month
                        let to_day = to_day_box.val() ? to_day_box.val() : sender.date_range.max.day

                        let from_date = `${from_year}-${from_month}-${from_day}`
                        let to_date = `${to_year}-${to_month}-${to_day}`

                        if (!isNaN(new Date(from_date)) && !isNaN(new Date(to_date))) {
                            sender.criteria['r_date_composed'] = `${from_date}to${to_date}`
                            sender.load_results(true)
                        } else {
                            console.log(`${from_date}to${to_date}`)
                        }
                    })
                }
            }
        )

        // ENTITY FILTERS
        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Entity/`,
            'GET',
            {'s_name': 'asc', 'page-size': 1000},
            function(data) {
                if (data.records) {
                    data.records.forEach(e => {
                        let entity_type = e.entity_type
                        let filter = sender.filters[entity_type]
                        let select_box = jQuery(`#adv-search-${filter.control_name}-filter`)
                        if (!select_box.length) console.log(entity_type)
                        select_box.append(`<option value="${e[filter.identifier]}">${e.name}</option>`)
                    })

                    if (sender.melp.medium === 'desktop') sender.build_filter_boxes()

                    jQuery('.filter-box').change(function() {
                        let select_box = jQuery(this)
                        sender.perform_entity_filter(select_box.data('entity_type'))
                    })

                    if (sender.initial_filter) {
                        jQuery(`.filter-box[data-entity_type=${sender.initial_filter}]`).val(sender.filters[sender.initial_filter]['initial']).trigger('change')
                        jQuery(`#adv-search-${sender.filters[sender.initial_filter].control_name}-filter-container`).prop('open', true)
                    }
                }
            },
            true,
            true
        )

        // CLEAR FILTER BUTTON
        jQuery('#adv-search-clear-filter-button').click(function() {
            sender.resetting_filters = true

            jQuery('.filter-box').each(function() {
                let filter_box = jQuery(this)
                filter_box.val(null).trigger('change')
            })

            sender.load_results(true)
            sender.resetting_filters = false
        })

        if (!this.initial_filter) this.load_results(true)
    }

    load_results(reset=false) {
        let results_div = jQuery('#adv-search-results')
        let total_counter = jQuery('#adv-search-total-results')
        let current_counter = jQuery(`#adv-search-current-result`)
        let sender = this

        if (reset){
            results_div.empty()
            sender.criteria.page = 1
            current_counter.html('0')
        }

        if (sender.search_box.val().length) {
            let all_fields = jQuery('#adv-search-type-metadata').is(':checked')

            if (all_fields) sender.criteria.q = sender.search_box.val().trim()
            else sender.criteria.q_html = sender.search_box.val().trim()
        } else {
            if ('q' in sender.criteria) delete sender.criteria['q']
            if ('q_html' in sender.criteria) delete sender.criteria['q_html']
        }

        console.log(this.criteria)

        sender.melp.make_request(
            `/api/corpus/${sender.melp.corpus_id}/Letter/`,
            'GET',
            sender.criteria,
            function(data) {
                if (data.meta && data.records) {
                    let page = data.meta.page
                    let page_size = data.meta.page_size
                    sender.next_page_threshold = parseInt(((page - 1) * page_size) + ((page_size / 3) * 2))
                    total_counter.html(data.meta.total)

                    if (!data.meta.has_next_page) sender.next_page_threshold = 0

                    data.records.forEach((letter, letter_index) => {
                        let letter_count = ((page - 1) * page_size) + letter_index + 1

                        results_div.append(`
                            <div id="adv-search-result-${letter.id}" class="adv-search-result" data-id="${letter.id}" data-count="${letter_count}">
                                <a href="/letters/${letter.identifier}" target="_blank">${letter.title}</a>
                            </div>
                        `)

                        if (letter_index === 0) current_counter.html('1')
                    })

                    jQuery('.adv-search-result').each(function() {
                        let l = jQuery(this)
                        if (!l.data('observed')) {
                            sender.result_watcher.observe(l[0])
                            l.data('observed', true)
                        }
                    })

                    if (data.meta.aggregations) {
                        let relevant = { PERSON: [], WORK: [], PLACE: [], ORG: [] }

                        if (data.meta.aggregations.authors) {
                            Object.keys(data.meta.aggregations.authors).forEach(author_id => relevant.PERSON.push(author_id))
                        }
                        if (data.meta.aggregations.recipients) {
                            Object.keys(data.meta.aggregations.recipients).forEach(recip_id => relevant.PERSON.push(recip_id))
                        }
                        if (data.meta.aggregations.entities) {
                            Object.keys(data.meta.aggregations.entities).forEach(entity => {
                                let [xml_id, entity_type] = entity.split('|||')
                                relevant[entity_type].push(xml_id)
                            })
                        }
                        if (data.meta.aggregations.repos) {
                            Object.keys(data.meta.aggregations.repos).forEach(repo_id => relevant.ORG.push(repo_id))
                        }

                        relevant.PERSON = Array.from(new Set(relevant.PERSON))

                        Object.keys(relevant).forEach(entity_type => {
                            let filter = sender.filters[entity_type]
                            jQuery(`#adv-search-${filter.control_name}-filter option`).each(function() {
                                let option = jQuery(this)
                                if (!relevant[entity_type].includes(option.attr('value'))) {
                                    option.prop('disabled', true)
                                } else option.prop('disabled', false)
                            })
                        })
                    }
                }
            }
        )
    }

    build_filter_boxes() {
        let sender = this
        jQuery('.filter-box').each(function() {
            let filter_box = jQuery(this)
            let entity_type = filter_box.data('entity_type')
            let filter = sender.filters[entity_type]
            filter_box.select2({
                placeholder: filter.placeholder,
                dropdownParent: jQuery(`#adv-search-${filter.control_name}-filter-container`),
                width: '100%'
            })
        })
    }

    destroy_filter_boxes() {
        jQuery('.filter-box').each(function() {
            let filter_box = jQuery(this)
            filter_box.select2('destroy')
        })
    }

    perform_entity_filter(entity_type) {
        let select_box = jQuery(`#adv-search-${this.filters[entity_type].control_name}-filter`)
        let entities_requested = select_box.val()
        let entities_added = []
        let entities_removed = []

        this.filters[entity_type].active.forEach(current_entity => {
            if (!entities_requested.includes(current_entity)) {
                entities_removed.push(current_entity)
            }
        })
        entities_requested.forEach(new_entity => {
            if (!this.filters[entity_type].active.includes(new_entity)) {
                entities_added.push(new_entity)
            }
        })

        this.filters[entity_type].active = entities_requested
        entities_added.forEach(entity => {
            this.filters[entity_type].parameters.forEach(param => {
                this.add_criteria(param, entity)
            })
        })
        entities_removed.forEach(entity => {
            this.filters[entity_type].parameters.forEach(param => {
                this.remove_criteria(param, entity)
            })
        })

        if (this.filters['PERSON'].active.length === 1) this.criteria['operator'] = 'or'
        else delete this.criteria['operator']

        if (!this.resetting_filters) this.load_results(true)
    }

    add_criteria(key, value) {
        if (key in this.criteria) {
            let current_values = this.criteria[key].split('__')
            if (!current_values.includes(value)) current_values.push(value)
            this.criteria[key] = current_values.join('__')
        } else {
            this.criteria[key] = value
        }
    }

    remove_criteria(key, value) {
        if (key in this.criteria) {
            let current_values = this.criteria[key].split('__')
            current_values = current_values.filter(function(e) { return e !== value })
            if (!current_values.length) delete this.criteria[key]
            else this.criteria[key] = current_values.join('__')
        }
    }

    show_search_modal() {
        this.search_modal.css('display', 'flex')
        jQuery('body').css('position', 'fixed')
    }

    hide_search_modal() {
        this.search_modal.css('display', 'none')
        jQuery('body').css('position', 'unset')
    }
}


class LetterViewer {
    constructor(melp_instance, letter_id) {
        this.melp = melp_instance
        this.letter_id = letter_id
        this.letter_viewer = null
        this.previous_letter = null
        this.next_letters = []
        this.thumbnail_div = jQuery('#letter-image-thumbs')
        this.viewer_div = jQuery('#letter-image-viewer')
        this.transcript_div = jQuery('#letter-transcript-viewer')
        this.pages_highlighted = []
        this.pbs = null
        this.last_pb_scrolled = null
        this.scroll_timer = null
        this.current_page = 0
        this.entities = {}

        let sender = this

        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Letter/`,
            'GET',
            {s_date_composed: 'asc', only: 'identifier', 'page-size': 1000},
            function(sorted_identifiers) {
                if (sorted_identifiers.records) {
                    let last_letter = null
                    let current_found = false

                    sorted_identifiers.records.forEach(l => {
                        if (l.identifier === letter_id) {
                            sender.previous_letter = last_letter
                            current_found = true
                        }
                        else if (current_found && sender.next_letters.length < 2) sender.next_letters.push(l.identifier)
                        else last_letter = l.identifier
                    })
                }

                sender.melp.make_request(
                    `/api/corpus/${sender.melp.corpus_id}/Letter/?f_identifier=${letter_id}`,
                    'GET',
                    {},
                    function(data) {
                        if (data.records && data.records.length === 1) {
                            let letter = data.records[0]

                            // fix dates
                            let date_composed = letter.date_composed
                            let date_transcribed = letter.date_transcribed

                            if (date_composed && date_composed.indexOf('T')) date_composed = date_composed.split('T')[0]
                            else date_composed = 'N/A'

                            if (date_transcribed && date_transcribed.indexOf('T')) date_transcribed = date_transcribed.split('T')[0]
                            else date_transcribed = 'N/A'

                            // set title
                            jQuery('#letter-title').html(letter.title)

                            // set prev and next letter links
                            let prev_letter = jQuery('#previous-letter-link')
                            let next_letter = jQuery('#next-letter-link')
                            if (sender.previous_letter) prev_letter.attr('href', `/letters/${sender.previous_letter}`)
                            else prev_letter.hide()
                            if (sender.next_letters.length) next_letter.attr('href', `/letters/${sender.next_letters[0]}`)
                            else next_letter.hide()

                            // set metadata fields
                            jQuery('#letter-xml-link').attr('href', `${sender.melp.github_prefix}${sender.letter_id}`)
                            sender.set_metadata_field('author', letter.author ? letter.author.name : null)
                            sender.set_metadata_field('transcriber', letter.transcriber)
                            sender.set_metadata_field('repository', letter.repository ? letter.repository.name : null)
                            sender.set_metadata_field('recipient', letter.recipient ? letter.recipient.name : null)
                            sender.set_metadata_field('first-edition-date', date_transcribed)
                            sender.set_metadata_field('collection', letter.collection)
                            sender.set_metadata_field('written-date', date_composed)
                            sender.set_metadata_field('general-editors', letter.general_editors)

                            // build thumbnails
                            letter.images.forEach((image, image_index) => {
                                sender.thumbnail_div.append(`
                                    <img class="letter-thumbnail"
                                    alt="Click to show page ${image_index + 1}"
                                    src="https://iiif.dh.tamu.edu/iiif/2/MELP%2F${letter.identifier}%2F${image}/full/,110/0/default.jpg"
                                    onerror="melp.letter_viewer.register_missing_image(${image_index});"
                                    data-image_no="${image_index}"
                                    data-iiif_identifier="https://iiif.dh.tamu.edu/iiif/2/MELP%2F${letter.identifier}%2F${image}">
                                `)
                            })

                            // inject transcription and identify page breaks
                            sender.transcript_div.prepend(letter.html)
                            sender.pbs = jQuery('.page-break')

                            // register entities
                            if (letter.entities_mentioned && letter.entities_mentioned.length) {
                                letter.entities_mentioned.forEach(ent => {
                                    let ent_key = `${ent.entity_type}-${ent.xml_id}`
                                    let ent_box = jQuery(`#letter-${ent.entity_type}-facet`)
                                    let ent_url = `/letters/?${ent.entity_type}=${ent.xml_id}`

                                    if (!(ent_key in sender.entities)) {
                                        sender.entities[ent_key] = ent
                                    }

                                    ent_box.append(`
                                        <div><a href="${ent_url}">${ent.name}</a></div>
                                    `)
                                })
                            }

                            // rig up entity tooltips
                            jQuery('span.entity').each(function() {
                                let entity = jQuery(this)
                                tippy(entity[0], {
                                    arrow: true,
                                    animation: 'fade',
                                    trigger: 'click',
                                    interactive: true,
                                    allowHTML: true,
                                    content: 'Loading...',
                                    onShow(instance) {
                                        let ent_key = `${entity.data('entity_type')}-${entity.data('entity_id')}`
                                        if (ent_key in sender.entities) sender.populate_entity_details(entity, instance)
                                        else {
                                            sender.melp.make_request(
                                                `/api/corpus/${sender.melp.corpus_id}/Entity/`,
                                                'GET',
                                                {f_xml_id: entity.data('entity_id'), f_entity_type: entity.data('entity_type')},
                                                function(data) {
                                                    if (data.records && data.records.length) {
                                                        sender.entities[ent_key] = data.records[0]
                                                        sender.populate_entity_details(entity, instance)
                                                    }
                                                }
                                            )
                                        }
                                    }
                                })
                            })

                            // setup "up next" carousel
                            if (sender.next_letters.length) {
                                let carousel_container = jQuery('#letter-up-next-carousel')
                                carousel_container.attr('data-search_t_identifier', `${sender.next_letters.join('__')}`)
                                let carousel = new LetterCarousel(sender.melp, carousel_container)
                            } else jQuery('#letter-up-next').hide()

                            // rig up thumbnail click event
                            jQuery('.letter-thumbnail').click(function () {
                                sender.show_letter_image(jQuery(this).data('image_no'), true)
                            })

                            // rig up transcript scroll event to catch page rollover
                            sender.transcript_div.scroll(e => {
                                let y_top = sender.transcript_div.offset().top
                                let y_bot = y_top + 200

                                sender.pbs.each(function() {
                                    let pb = jQuery(this)
                                    let pb_y = pb.offset().top
                                    if (pb_y > y_top && pb_y < y_bot) sender.last_pb_scrolled = pb
                                })

                                if (sender.last_pb_scrolled) {
                                    clearTimeout(sender.scroll_timer)
                                    sender.scroll_timer = setTimeout(() => {
                                        let page_no = parseInt(sender.last_pb_scrolled.data('page')) - 1
                                        if (page_no !== sender.current_page) sender.show_letter_image(page_no)
                                    }, 1000)
                                }
                            })

                            // create citation info
                            let citation_months = ["January","February","March","April","May","June","July","August","September","October","November","December"]
                            let citation_date = new Date()
                            let citation_div = jQuery('#letter-citation')
                            citation_div.html(`
                                "${letter.title}," <i>Maria Edgeworth Letters Project</i>,${letter.collection ? ` ${letter.collection},` : ''}${letter.repository ? ` Courtesy of ${letter.repository.name}` : ''}. Retrieved from ${window.location.href}, ${citation_months[citation_date.getMonth()]} ${citation_date.getDate()}, ${citation_date.getFullYear()}.  
                            `)
                            citation_div.click(function() {
                                navigator.clipboard.writeText(citation_div.text().trim())
                            })
                            tippy(citation_div[0], {
                                arrow: true,
                                animation: 'fade',
                                trigger: 'click',
                                interactive: true,
                                allowHTML: true,
                                content: '<span style="color: black;">Copied to clipboard!</span>',
                            })

                            // show the first page image
                            sender.show_letter_image(0)
                        }
                    }
                )
            }
        )
    }

    set_metadata_field(field, value) {
        if (value) {
            jQuery(`#letter-metadata-${field}`).html(value)
        } else {
            jQuery(`#letter-metadata-${field}-div`).hide()
        }
    }

    show_top_of_letter() {
        let top_point = new OpenSeadragon.Point(0,0)
        this.letter_viewer.viewport.panTo(top_point)
        this.letter_viewer.viewport.applyConstraints()
    }

    show_letter_image(index, scrollTextIntoView=false) {
        const image = jQuery(`[data-image_no="${index}"]`)
        let viewer_options = {
            id:                 "letter-image-viewer",
            prefixUrl:          `${this.melp.plugin_url}/js/openseadragon/images/`,
            preserveViewport:   false,
            visibilityRatio:    1,
            minZoomLevel:       .25,
            maxZoomLevel:       5,
            defaultZoomLevel:   0,
            homeFillsViewer:    true,
            showRotationControl: true,
            tileSources:   [image.data('iiif_identifier')],
        }

        this.viewer_div.empty()
        if (this.melp.determine_medium() === 'mobile') {
            viewer_options['toolbar'] = 'letter-image-toolbar'
            jQuery('#letter-image-toolbar').empty()
        }

        this.letter_viewer = OpenSeadragon(viewer_options)
        let sender = this

        // fix toolbar styling
        let toolbar = jQuery('div[title="Zoom in"]').parent()
        toolbar.css('margin-top', '10px')
        toolbar.css('margin-left', '10px')
        toolbar.css('display', 'flex')
        toolbar.css('gap', '10px')
        toolbar.css('cursor', 'pointer')

        // rig up event to show top of letter once image loaded
        this.letter_viewer.addHandler('open', function () {
            let tiledImage = sender.letter_viewer.world.getItemAt(0)
            if (tiledImage.getFullyLoaded())
                sender.show_top_of_letter()
            else
                tiledImage.addOnceHandler('fully-loaded-change', function() { sender.show_top_of_letter() })
        })

        jQuery('.letter-thumbnail').each(function() {
            let thumb = jQuery(this)
            thumb.removeClass("current")
        })
        image.addClass("current")
        this.current_page = parseInt(index)
        let start_pb = this.highlight_page_text()

        if(scrollTextIntoView) {
            let trans_div_y = sender.transcript_div.offset().top
            let trans_div_scroll = sender.transcript_div.scrollTop()
            let start_pb_y = start_pb.offset().top
            let top_padding = 10

            // scroll up
            if (start_pb_y < trans_div_y) {
                let amount = trans_div_y - start_pb_y
                sender.transcript_div.scrollTop(trans_div_scroll - (amount + top_padding))
            } else {
                let amount = start_pb_y - trans_div_y
                sender.transcript_div.scrollTop(trans_div_scroll + (amount - top_padding))
            }
        }
    }

    highlight_page_text() {
        let start_pb = null
        let end_pb = null
        let range = document.createRange()
        let textNodes = []

        if (this.pages_highlighted.length) {
            jQuery('.page-highlight.active').each(function() {
                jQuery(this).removeClass('active')
            })
        }

        let sender = this

        this.pbs.each(function() {
            let pb = jQuery(this)

            if (parseInt(pb.data('page')) === sender.current_page + 1) {
                start_pb = pb
            } else if (start_pb) {
                end_pb = pb
                return false
            }
        })
        if (!end_pb) end_pb = jQuery('#letter-stretcher')

        if (this.pages_highlighted.includes(this.current_page)) {
            let highlights = jQuery(`.page-highlight.page-${this.current_page}`)
            highlights.each(function() {
                jQuery(this).addClass('active')
            })
        } else {
            range.setStart(start_pb[0], 0)
            range.setEnd(end_pb[0], 0)

            let rangeTextIterator = document.createNodeIterator(
                range.commonAncestorContainer,
                NodeFilter.SHOW_ALL,
                {
                    acceptNode: function (node) {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            )

            while (rangeTextIterator.nextNode()) {
                if (!textNodes.length && rangeTextIterator.referenceNode !== range.startContainer) continue;
                textNodes.push(rangeTextIterator.referenceNode);
                if (rangeTextIterator.referenceNode === range.endContainer) break;
            }

            textNodes.forEach(node => {
                if (node.nodeType === 3 && range.intersectsNode(node)) {
                    let highlighter = document.createElement('span')
                    highlighter.className = 'page-highlight'
                    highlighter.classList.add('active')
                    highlighter.classList.add(`page-${this.current_page}`)
                    node.parentNode.insertBefore(highlighter, node)
                    highlighter.appendChild(node)
                }
            })

            this.pages_highlighted.push(this.current_page)
        }

        return start_pb
    }

    register_missing_image(image_no) {
        console.log(`missing ${image_no}`)
    }

    populate_entity_details(entity_tag, tooltip) {
        let ent_key = `${entity_tag.data('entity_type')}-${entity_tag.data('entity_id')}`
        if (ent_key in this.entities) {
            let ent = this.entities[ent_key]
            let content = `<label class="entity-popup-label">${ent.name}</label>`

            if (ent.uris && ent.uris.length) {
                content += `<div class="entity-popup-uris">`
                ent.uris.forEach(uri => {
                    content += `<a href="${uri}" target="_blank">${uri}</a><br />`
                })
                content += `</div>`
            }

            let search_url =`/letters/?${entity_tag.data('entity_type')}=${entity_tag.data('entity_id')}`
            content += `
                      <button type="button" onclick="window.open('${search_url}', '_blank')">
                        Show letters with this ${entity_tag.data('entity_type').toLowerCase()}
                      </button>
                `

            tooltip.setContent(content)
        }
    }
}

