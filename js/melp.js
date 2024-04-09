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
        if (browse_by_container.length) this.load_template(browse_by_container, 'browse_by.html', null, true)

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
        }
        else if (this.medium === 'mobile') {
            // fix nav
            console.log('mobile adjustments...')
            this.nav.nav_menu.appendTo(this.nav.hamburger_nav_container)
            nav_search_button.html('Search')
            if (this.path !== '/') {
                console.log('moving search bar...')
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
                if (search_and_filter_div.length) {
                    jQuery('#adv-search-box').appendTo(search_and_filter_div)
                    jQuery('#adv-search-type-bar').appendTo(search_and_filter_div)
                    jQuery('#adv-search-filter').appendTo(search_and_filter_div)
                    jQuery('#adv-search-button').html(`<img src="${this.plugin_url}img/icon_filter.png"> Search & Filter`)
                }
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

                sender.nav_container.css('justify-content', 'end')
            }
        } else if (sender.melp.path.startsWith('/about')) {
            jQuery('#nav-menu-about').addClass('current')
        } else if (sender.melp.path.startsWith('/letters')) {
            jQuery('#nav-menu-current').addClass('current')
            if (sender.melp.path === '/letters/') {
                sender.nav_search.hide()
                sender.nav_title.css('margin-right', 'auto')
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
            'es_debug': 'y'
        }
        this.next_page_threshold = 0
        this.resetting_filters = false
        this.loaded_filters = []
        this.people = []
        this.works = []
        this.places = []
        this.repos = []
        this.search_box = jQuery('#adv-search-box')
        this.search_modal = jQuery('#adv-search-modal')

        let search_button = jQuery('#adv-search-button')
        let apply_filters_button = jQuery('#adv-search-modal-apply-button')
        let modal_close_button = jQuery('#adv-search-modal-close-button')
        let sort_select_box = jQuery('#adv-search-sort-box')

        let filter_div = jQuery('#adv-search-filter')
        let people_filter = jQuery('#adv-search-people-filter')
        let work_filter = jQuery('#adv-search-work-filter')
        let place_filter = jQuery('#adv-search-place-filter')
        let repo_filter = jQuery('#adv-search-repo-filter')

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
            sender.search_modal.css('display', 'none')
        })
        sort_select_box.change(function() {
            let sorter = jQuery(this)
            sender.criteria.s_date_composed = sorter.val()
            sender.load_results(true)
        })

        // PEOPLE FILTER
        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Entity/`,
            'GET',
            {'f_entity_type': 'PERSON', 's_name': 'asc', 'page-size': 1000},
            function(data) {
                if (data.records) {
                    data.records.forEach(person => {
                        people_filter.append(`<option value="${person.xml_id}">${person.name}</option>`)
                    })
                    people_filter.select2({
                        placeholder: 'Select a person...',
                        dropdownParent: filter_div,
                        width: '100%'
                    })

                    people_filter.change(function() {
                        let people_requested = people_filter.val()
                        let people_added = []
                        let people_removed = []

                        sender.people.forEach(current_person => {
                            if (!people_requested.includes(current_person)) {
                                people_removed.push(current_person)
                            }
                        })

                        people_requested.forEach(new_person => {
                            if (!sender.people.includes(new_person)) {
                                people_added.push(new_person)
                            }
                        })

                        sender.people = people_requested
                        people_added.forEach(person => {
                            sender.add_criteria('t_author.xml_id|', person)
                            sender.add_criteria('t_recipient.xml_id|', person)
                            sender.add_criteria('t_entities_mentioned.xml_id|', person)
                        })
                        people_removed.forEach(person => {
                            sender.remove_criteria('t_author.xml_id|', person)
                            sender.remove_criteria('t_recipient.xml_id|', person)
                            sender.remove_criteria('t_entities_mentioned.xml_id|', person)
                        })

                        if (sender.people.length === 1) sender.criteria['operator'] = 'or'
                        else delete sender.criteria['operator']

                        if (!sender.resetting_filters) sender.load_results(true)
                    })
                }
                sender.loaded_filters.push('people')
            },
            true,
            true
        )

        // WORK FILTER
        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Entity/`,
            'GET',
            {'f_entity_type': 'WORK', 's_name': 'asc', 'page-size': 1000},
            function(data) {
                if (data.records) {
                    data.records.forEach(work => {
                        work_filter.append(`<option value="${work.xml_id}">${work.name}</option>`)
                    })
                    work_filter.select2({
                        placeholder: 'Select a work...',
                        dropdownParent: filter_div,
                        width: '100%'
                    })

                    work_filter.change(function() {
                        let works_requested = work_filter.val()
                        let works_added = []
                        let works_removed = []

                        sender.works.forEach(current_work => {
                            if (!works_requested.includes(current_work)) {
                                works_removed.push(current_work)
                            }
                        })

                        works_requested.forEach(new_work => {
                            if (!sender.works.includes(new_work)) {
                                works_added.push(new_work)
                            }
                        })

                        sender.works = works_requested
                        works_added.forEach(work => {
                            sender.add_criteria('f_entities_mentioned.xml_id|', work)
                        })
                        works_removed.forEach(work => {
                            sender.remove_criteria('f_entities_mentioned.xml_id|', work)
                        })

                        if (!sender.resetting_filters) sender.load_results(true)
                    })
                }
                sender.loaded_filters.push('works')
            },
            true,
            true
        )

        // PLACE FILTER
        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Entity/`,
            'GET',
            {'f_entity_type': 'PLACE', 's_name': 'asc', 'page-size': 1000},
            function(data) {
                if (data.records) {
                    data.records.forEach(place => {
                        place_filter.append(`<option value="${place.xml_id}">${place.name}</option>`)
                    })
                    place_filter.select2({
                        placeholder: 'Select a place...',
                        dropdownParent: filter_div,
                        width: '100%'
                    })

                    place_filter.change(function() {
                        let places_requested = place_filter.val()
                        let places_added = []
                        let places_removed = []

                        sender.places.forEach(current_place => {
                            if (!places_requested.includes(current_place)) {
                                places_removed.push(current_place)
                            }
                        })

                        places_requested.forEach(new_place => {
                            if (!sender.places.includes(new_place)) {
                                places_added.push(new_place)
                            }
                        })

                        sender.places = places_requested
                        places_added.forEach(place => {
                            sender.add_criteria('f_entities_mentioned.xml_id|', place)
                        })
                        places_removed.forEach(place => {
                            sender.remove_criteria('f_entities_mentioned.xml_id|', place)
                        })

                        if (!sender.resetting_filters) sender.load_results(true)
                    })
                }
                sender.loaded_filters.push('places')
            },
            true,
            true
        )

        // REPO FILTER
        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Entity/`,
            'GET',
            {'f_entity_type': 'ORG', 's_name': 'asc', 'page-size': 1000},
            function(data) {
                if (data.records) {
                    data.records.forEach(repo => {
                        repo_filter.append(`<option value="${repo.id}">${repo.name}</option>`)
                    })
                   repo_filter.select2({
                       placeholder: 'Select a repository...',
                       dropdownParent: filter_div,
                       width: '100%'
                   })

                    repo_filter.change(function() {
                        let repos_requested = repo_filter.val()
                        let repos_added = []
                        let repos_removed = []

                        sender.repos.forEach(current_repo => {
                            if (!repos_requested.includes(current_repo)) {
                                repos_removed.push(current_repo)
                            }
                        })

                        repos_requested.forEach(new_repo => {
                            if (!sender.repos.includes(new_repo)) {
                                repos_added.push(new_repo)
                            }
                        })

                        sender.repos = repos_requested
                        repos_added.forEach(repo => {
                            sender.add_criteria('f_repository.id|', repo)
                        })
                        repos_removed.forEach(repo => {
                            sender.remove_criteria('f_repository.id|', repo)
                        })

                        if (!sender.resetting_filters) sender.load_results(true)
                    })
                }
                sender.loaded_filters.push('repos')
            },
            true,
            true
        )

        // CLEAR FILTER BUTTON
        jQuery('#adv-search-clear-filter-button').click(function() {
            sender.resetting_filters = true

            people_filter.val(null).trigger('change')
            work_filter.val(null).trigger('change')
            place_filter.val(null).trigger('change')
            repo_filter.val(null).trigger('change')

            sender.load_results(true)
            sender.resetting_filters = false
        })

        this.load_results(true)
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
                }
            }
        )
    }

    async rebuild_filter_boxes() {
        while (this.loaded_filters.length < 4) await new Promise(resolve => setTimeout(resolve, 2000))
        jQuery('.filter-box').each(function() {
            let box = jQuery(this)
            box.select2('destroy')
            box.select2({'placeholder': `Select a ${box.data('type_label')}...`, width: '100%'})
        })
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
    }
}


class LetterViewer {
    constructor(melp_instance, letter_id) {
        this.melp = melp_instance
        this.letter_viewer = null
        this.previous_letter = null
        this.next_letters = []
        this.thumbnail_div = jQuery('#letter-image-thumbs')
        this.viewer_div = jQuery('#letter-image-viewer')
        this.transcript_div = jQuery('#letter-transcript-viewer')
        this.pages_highlighted = []
        this.pbs = null
        this.current_scroll_direction = 'down'
        this.last_pb_y = 0
        this.current_page = 0
        this.next_page = -1

        let sender = this

        this.melp.make_request(
            `/api/corpus/${this.melp.corpus_id}/Letter/`,
            'GET',
            {s_date_composed: 'asc', only: 'identifier', 'page-size': 1000},
            function(sorted_identifiers) {
                if (sorted_identifiers.records) {
                    let last_letter = null
                    let current_found = false
                    console.log(letter_id)
                    sorted_identifiers.records.forEach(l => {
                        if (l.identifier === letter_id) {
                            sender.previous_letter = last_letter
                            current_found = true
                        }
                        else if (current_found && sender.next_letters.length < 2) sender.next_letters.push(l.identifier)
                        else last_letter = l.identifier
                    })
                    console.log(sender.previous_letter)
                    console.log(sender.next_letters)
                }

                sender.melp.make_request(
                    `/api/corpus/${sender.melp.corpus_id}/Letter/?f_identifier=${letter_id}`,
                    'GET',
                    {},
                    function(data) {
                        if (data.records && data.records.length === 1) {
                            let letter = data.records[0]

                            // fix date
                            let date_composed = letter.date_composed
                            if (date_composed && date_composed.indexOf('Y')) date_composed = date_composed.split('T')[0]
                            else date_composed = 'N/A'

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
                            jQuery('#letter-metadata-author').html(letter.author ? letter.author.name : 'N/A')
                            jQuery('#letter-metadata-transcriber').html('N/A')
                            jQuery('#letter-metadata-repository').html(letter.repository ? letter.repository.name : 'N/A')
                            jQuery('#letter-metadata-recipient').html(letter.recipient ? letter.recipient.name : 'N/A')
                            jQuery('#letter-metadata-first-edition-date').html('N/A')
                            jQuery('#letter-metadata-collection').html('N/A')
                            jQuery('#letter-metadata-written-date').html(date_composed)
                            jQuery('#letter-metadata-general-editors').html('N/A')

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

                            // setup "up next" carousel
                            if (sender.next_letters.length) {
                                let carousel_container = jQuery('#letter-up-next-carousel')
                                carousel_container.attr('data-search_t_identifier', `${sender.next_letters.join('__')}`)
                                let carousel = new LetterCarousel(sender.melp, carousel_container)
                            } else jQuery('#letter-up-next').hide()

                            // rig up thumbnail click event
                            jQuery('.letter-thumbnail').click(function () {
                                sender.show_letter_image(jQuery(this).data('image_no'))
                            })

                            // determine when the letter image should change while scrolling through letter
                            let page_rollover_threshold = {
                                start: sender.transcript_div.offset().top,
                                end: sender.transcript_div.offset().top + 100
                            }

                            // rig up transcript scroll event to catch page rollor
                            sender.transcript_div.scroll(e => {
                                let current_pb_y = sender.pbs.first().offset().top
                                if (current_pb_y > sender.last_pb_y) sender.current_scroll_direction = "up"
                                else sender.current_scroll_direction = "down"
                                sender.last_pb_y = current_pb_y

                                sender.pbs.each(function () {
                                    let pb = jQuery(this)
                                    let pb_y = pb.offset().top
                                    if (pb_y >= page_rollover_threshold.start && pb_y <= page_rollover_threshold.end) {
                                        let modifier = 1
                                        if (sender.current_scroll_direction === "up") modifier = 2

                                        sender.next_page = parseInt(pb.data('page')) - modifier
                                        if (sender.next_page < 0) sender.next_page = 0
                                    }
                                })

                                if (sender.next_page > -1 && sender.next_page !== sender.current_page) {
                                    sender.show_letter_image(sender.next_page)
                                }
                            })

                            // show the first page image
                            sender.show_letter_image(0)
                        }
                    }
                )
            }
        )
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
            start_pb[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
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
}

