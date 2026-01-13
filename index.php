<?php
/**
 * Plugin Name: MELP
 * Plugin URI: https://mariaedgeworth.org
 * Description: A plugin for allowing a Wordpress frontend to interface with Corpora
 * Author: Bryan Tarpley
 * Author URI: https://codhr.tamu.edu
 * Version: 1.1.0
 * License: GPL2+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.txt
 *
 * @package CGB
 */

// Exit if accessed directly.
	if (! defined( 'ABSPATH' ) ) 
	{
		exit;
	}

    // -------------------------- //
    // FRONT FACING SITE          //
    // -------------------------- //
	function add_melp_rewrite_rules() {
	    $page = get_page_by_path('letters');
	    $page_id = $page->ID;
	    add_rewrite_rule('^letters/([^/]*)/?', 'index.php?page_id=' . $page_id . '&letter=$matches[1]', 'top');
	}
	add_action('init', 'add_melp_rewrite_rules', 10, 0);


	wp_enqueue_style('dashicons');
	add_action('wp_enqueue_scripts','melp_corpora_enqueue_scripts');

	function melp_corpora_enqueue_scripts()
	{
	    // Get plugin version for cache busting
        if (!function_exists('get_plugin_data')) {
            require_once(ABSPATH . 'wp-admin/includes/plugin.php');
        }
        $plugin_data = get_plugin_data(__FILE__);
        $plugin_version = $plugin_data['Version'];

		// Register Javascript
		wp_enqueue_script('jquery');
		wp_enqueue_script('jquery-mark', plugin_dir_url(__FILE__).'js/jquery.mark.min.js');
		wp_enqueue_script('melp-popper', plugin_dir_url(__FILE__).'js/popper.min.js');
		wp_enqueue_script('melp-tippy', plugin_dir_url(__FILE__).'js/tippy-bundle.umd.min.js', array('melp-popper'));
		wp_enqueue_script('melp-select2', plugin_dir_url(__FILE__).'js/select2.full.min.js');
		wp_enqueue_script('melp-autocomplete', plugin_dir_url(__FILE__).'js/autoComplete.min.js');
		wp_enqueue_script('melp-openseadragon', plugin_dir_url(__FILE__).'js/openseadragon/openseadragon.min.js');
		wp_enqueue_script('melp-leaflet', plugin_dir_url(__FILE__).'js/leaflet.js');
		wp_enqueue_script('melp-leaflet-cluster', plugin_dir_url(__FILE__).'js/leaflet.markercluster.js');
		wp_enqueue_script(
		    'melp-script',
		    plugin_dir_url( __FILE__ ).'js/melp.js',
		    array(
		        'jquery',
		        'jquery-mark',
		        'melp-popper',
		        'melp-tippy',
		        'melp-select2',
		        'melp-autocomplete',
		        'melp-openseadragon',
		        'melp-leaflet',
		        'melp-leaflet-cluster'
            ),
            $plugin_version
        ); //your javascript library

		// Register CSS
		wp_enqueue_style('melp-select2-css', plugin_dir_url( __FILE__ ).'css/select2.min.css');
		wp_enqueue_style('melp-autocomplete-css', plugin_dir_url( __FILE__ ).'css/autoComplete.min.css');
		wp_enqueue_style('melp-leaflet-css', plugin_dir_url( __FILE__ ).'css/leaflet/leaflet.css');
		wp_enqueue_style('melp-leaflet-cluster-css', plugin_dir_url( __FILE__ ).'css/MarkerCluster.css');
		wp_enqueue_style('melp-css', plugin_dir_url( __FILE__ ).'css/melp.css', array(), $plugin_version);
		wp_enqueue_style('melp-tablet-css', plugin_dir_url( __FILE__ ).'css/melp_tablet.css');
		wp_enqueue_style('melp-mobile-css', plugin_dir_url( __FILE__ ).'css/melp_mobile.css');
	}

	function melp_corpora_inject_footer()
	{
	    $corpora_host = get_option('corpora_host_field');
	    $corpus_id = get_option('corpora_corpus_field');
	    $corpora_token = getenv('MELP_TOKEN');
	    $iiif_prefix = get_option('corpora_iiif_prefix_field');
	    $github_prefix = get_option('corpora_github_prefix_field');

	    if (!$corpora_token) {
	        $corpora_token = '';
	    }

?>
		<script>
		    let melp = null
		    let plugin_url = "<?php echo plugin_dir_url( __FILE__ ); ?>"

			jQuery(document).ready(function($)
			{
				melp = new MELP(
				    '<?=$corpora_host?>',
				    '<?=$corpora_token?>',
				    '<?=$corpus_id?>',
				    plugin_url,
				    '<?=$iiif_prefix?>',
				    '<?=$github_prefix?>'
                )
			});
		</script>	
<?php		
	}
	add_action('wp_footer', 'melp_corpora_inject_footer');

	// -------------------------- //
    // ADMIN SIDE OF FENCE        //
    // -------------------------- //

    // Add Corpora page to WP settings in Dashboard
    function corpora_setup_config_menu() {
        add_menu_page(
            'Corpora Configuration',
            'Corpora',
            'manage_options',
            'corpora-config',
            'corpora_render_config_page',
            plugin_dir_url( __FILE__ ).'img/corpora-config.png'
        );
    }
    add_action('admin_menu', 'corpora_setup_config_menu');

    // Render settings page
    function corpora_render_config_page() {
        ?>
            <h1> <?php esc_html_e( 'Corpora Settings', 'corpora-textdomain' ); ?> </h1>
            <form method="POST" action="options.php">
            <?php
            settings_fields( 'corpora-config' );
            do_settings_sections( 'corpora-config' );
            submit_button();
            ?>
            </form>
        <?php
    }

    // Initialize the various settings on the settings page so they can be saved to the WP database
    function corpora_setup_config_settings() {
        add_settings_section(
            'corpora_config_host_section',
            '',
            'corpora_render_config_host_section',
            'corpora-config'
        );

        add_settings_field(
            'corpora_host_field',
            __('Corpora Host', 'corpora-textdomain'),
            'corpora_render_config_host_field',
            'corpora-config',
            'corpora_config_host_section'
        );
        register_setting('corpora-config', 'corpora_host_field');

        add_settings_field(
            'corpora_corpus_field',
            __('Corpus', 'corpora-textdomain'),
            'corpora_render_config_corpus_field',
            'corpora-config',
            'corpora_config_host_section'
        );
        register_setting('corpora-config', 'corpora_corpus_field');

        add_settings_field(
            'corpora_iiif_prefix_field',
            __('IIIF Image Prefix', 'corpora-textdomain'),
            'corpora_render_config_iiif_prefix_field',
            'corpora-config',
            'corpora_config_host_section'
        );
        register_setting('corpora-config', 'corpora_iiif_prefix_field');

        add_settings_field(
            'corpora_github_prefix_field',
            __('GitHub URL Prefix', 'corpora-textdomain'),
            'corpora_render_config_github_prefix_field',
            'corpora-config',
            'corpora_config_host_section'
        );
        register_setting('corpora-config', 'corpora_github_prefix_field');
    }
    add_action( 'admin_init', 'corpora_setup_config_settings' );

    // Render host field
    function corpora_render_config_host_field () {
        ?>
        <input type="text" id="corpora_host_field" name="corpora_host_field" value="<?php echo get_option( 'corpora_host_field' ); ?>" style="width: 100%">
        <div id="corpora_host_field_error_message" style="display: none; font-style: italic;">
            The current value for the Corpora host field is either incorrect or the Corpora host is unreachable.
        </div>
        <?php
    }

    // Render corpus field
    function corpora_render_config_corpus_field () {
        ?><select id="corpora_corpus_field" name="corpora_corpus_field" disabled></select><?php
    }

    // Render IIIF prefix field
    function corpora_render_config_iiif_prefix_field () {
        ?>
        <input type="text" id="corpora_iiif_prefix_field" name="corpora_iiif_prefix_field" value="<?php echo get_option( 'corpora_iiif_prefix_field' ); ?>" style="width: 100%">
        <?php
    }

    // Render GitHub prefix field
    function corpora_render_config_github_prefix_field () {
        ?>
        <input type="text" id="corpora_github_prefix_field" name="corpora_github_prefix_field" value="<?php echo get_option( 'corpora_github_prefix_field' ); ?>" style="width: 100%">
        <?php
    }

    // Render host config section
    function corpora_render_config_host_section() {
        ?>
        <script type="application/javascript">
            let corporaHostTimer = null
            let corporaHost = "<?php echo get_option( 'corpora_host_field' ); ?>"
            let corpusID = "<?php echo get_option( 'corpora_corpus_field' ); ?>"

            document.addEventListener('DOMContentLoaded', function() {
                let corporaHostBox = document.getElementById('corpora_host_field')

                corporaHostBox.addEventListener('input', function(event) {
                    clearTimeout(corporaHostTimer)
                    corporaHostTimer = setTimeout(() => {
                        corporaHost = event.target.value
                        setupCorpusBox()
                    }, 2000)
                })

                if (corporaHost) setupCorpusBox()
            })

            function setupCorpusBox() {
                let corporaHostErrorMsgDiv = document.getElementById('corpora_host_field_error_message')
                let corpusBox = document.getElementById('corpora_corpus_field')

                fetch(`${corporaHost}/api/corpus/`)
                    .then(response => {
                        if (!response.ok) throw new Error('Network response was not ok')
                        return response.json()
                    })
                    .then(corporaData => {
                        if (corporaData.records) {
                            corporaData.records.forEach(corpus => {
                                corpusBox.add(new Option(corpus.name, corpus.id, false, corpus.id === corpusID))
                            })

                            corporaHostErrorMsgDiv.style.display = 'none'
                            corpusBox.disabled = false
                        }
                    })
                    .catch(error => {
                        corporaHostErrorMsgDiv.style.display = 'block'
                        corpusBox.disabled = true
                    })
            }
        </script>
        <?php
    }
