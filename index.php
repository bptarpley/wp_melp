<?php
/**
 * Plugin Name: MELP
 * Plugin URI: https://mariaedgeworth.org
 * Description: A plugin for allowing a Wordpress frontend to interface with Corpora
 * Author: Bryan Tarpley
 * Author URI: https://codhr.tamu.edu
 * Version: 1.0.0
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
            )
        ); //your javascript library

		// Register CSS
		wp_enqueue_style('melp-select2-css', plugin_dir_url( __FILE__ ).'css/select2.min.css');
		wp_enqueue_style('melp-autocomplete-css', plugin_dir_url( __FILE__ ).'css/autoComplete.min.css');
		wp_enqueue_style('melp-leaflet-css', plugin_dir_url( __FILE__ ).'css/leaflet/leaflet.css');
		wp_enqueue_style('melp-leaflet-cluster-css', plugin_dir_url( __FILE__ ).'css/MarkerCluster.css');
		wp_enqueue_style('melp-css', plugin_dir_url( __FILE__ ).'css/melp.css');
	}

	function melp_corpora_inject_footer()
	{
	    $corpora_host = getenv('MELP_CORPORA_HOST');
	    $corpus_id = getenv('MELP_CORPUS_ID');
	    $corpora_token = getenv('MELP_TOKEN');
	    $iiif_prefix = getenv('MELP_IIIF_PREFIX');

	    if (!$corpora_token) {
	        $corpora_token = '';
	    }

?>
		<script>
		    let melp = null
		    let plugin_url = "<?php echo plugin_dir_url( __FILE__ ); ?>"

			jQuery(document).ready(function($)
			{
				tap = new MELP(
				    '<?=$corpora_host?>',
				    '<?=$corpora_token?>',
				    '<?=$corpus_id?>',
				    plugin_url,
				    '<?=$iiif_prefix?>'
                )
			});
		</script>	
<?php		
	}
	add_action('wp_footer', 'melp_corpora_inject_footer');

