/**
 * Code Editor for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */
 
 
define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var markup = require("text!ext/imgview/imgview.xml");
var editors = require("ext/editors/editors");

module.exports = ext.register("ext/imgview/imgview", {
    name    : "Image Viewer",
    dev     : "Ajax.org",
    fileExtensions : [
        "bmp",
        "djv",
        "djvu",
        "gif",
        "ico",
        "jpg",
        "jpeg",
        "pbm",
        "pgm",
        "png",
        "pnm",
        "ppm",
        "psd",
        "tiff",
        "xbm",
        "xpm"
    ],
    type    : ext.EDITOR,
    markup  : markup,
    deps    : [editors],

    nodes : [],

    setDocument : function(doc, actiontracker){
        doc.session = doc.getNode().getAttribute("path");
        imgEditor.setProperty("value", doc.session);
    },

    hook : function() {

    },

    init : function(amlPage) {
        amlPage.appendChild(imgEditor);
        imgEditor.show();

        this.imgEditor = this.amlEditor = imgEditor;
        //this.nodes.push();
    },

    enable : function() {
        this.nodes.each(function(item){
            item.show();
        });
    },

    disable : function() {
        this.nodes.each(function(item){
            item.hide();
        });
    },

    destroy : function(){
        this.nodes.each(function(item){
            item.destroy(true, true);
        });

        this.nodes = [];
    }
});

});
