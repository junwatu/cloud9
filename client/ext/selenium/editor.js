/**
 * Code Editor for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

/*
    Ideas:
        * Hover over the datagrid highlights the element it pertains
        * Easily remove and add assertions/actions
            * add assertion by picking element
            * then present datagrid of properties in context menu style
            * check one or more properties
            * allow to change the value in assertion datagrid
        * drag&drop assertions and actions
        * instead of dividers, make them headings and allow for rename to set test name
            * parent element instead of divider
            * default the name "Recorded Test 1"
        * hide and show advanced view
        * load previous tests
        * Allow to easily play tests locally or on saucelabs
            * The latter should show a movie
            * and make assertions green/red - also should scroll dg
        - Locally play test to return to state
        - Context Menu
            - Play until here
            - Play this test
            - 
        * Run should be disabled until a test is loaded/recorded
        * Datagrid needs drag indicators (seemed to have some before)
        - Datagrid should automatically scroll down during recording, unless
          the user scrolled it up manually
        * Multiselect drag&drop
        
    Bug:
        - Datagrid + textbox editing doesnt work (2nd time broken, skin bad)
        * Update element of action after drag&drop
        - After drag&drop the datagrid isnt expanded
        - After assertion (disabling all children) the dynamic props are gone
        - double clicking also registers the mouseup and down

*/
 
define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var markup = require("text!ext/selenium/editor.xml");
var editors = require("ext/editors/editors");

module.exports = ext.register("ext/selenium/editor", {
    name    : "Selenium Editor",
    dev     : "Ajax.org",
    type    : ext.EDITOR,
    markup  : markup,
    deps    : [editors],

    fileExtensions : ["stest"],
    
    nodes : [],

    setDocument : function(doc, actiontracker){
        //doc.session = doc.getNode().getAttribute("path");

        var _self = this;
        
        if (!doc.isSeleniumInited) {
            doc.addEventListener("prop.value", function(e) {
                if (this.editor != _self)
                    return;
                
                try {
                    var json = JSON.parse(e.value);
                }
                catch(e) {
                    dgUiRecorder.setAttribute("empty-message", "Could not load test: " + e.message);
                    dgUiRecorder.clear();
                    
                    return;
                }
    
                var xml = _self.convertToXml(json);
                _self.model.load(xml);
                
                doc.isInited = true;
            });
            
            doc.addEventListener("retrievevalue", function(e) {
                if (this.editor != _self)
                    return;

                if (!doc.isInited) 
                    return e.value;
                else 
                    return JSON.stringify(_self.getTests(), null, '    ');
            });
            
            doc.addEventListener("close", function(){
                if (this.editor != _self)
                    return;
                
                //??? destroy doc.acesession
            });
            
            doc.isSeleniumInited = true;
        }

        if (doc.editor && doc.editor != this) {
            var value = doc.getValue();
            if (JSON.stringify(_self.getTests(), null, '    ') !== value) {
                doc.editor = this;
                doc.dispatchEvent("prop.value", {value : value});
            }
        }
        else {
            doc.editor = this;
        }
    },

    hook : function() {
        
    },

    init : function(amlPage) {
        amlPage.appendChild(mainUiRecorder);
        mainUiRecorder.show();

        this.editor = mainUiRecorder;
        
        var _self = this;
        window.addEventListener("message", function(e) {
            if (e.origin !== "http://127.0.0.1:5001")
                return;
            
            try {
                var json = typeof e.data == "string" ? JSON.parse(e.data) : e.data;
            } catch (e) {
                return;
            }
        
            switch (json.type) {
                case "pong":
                    _self.pong();
                case "event":
                    ide.dispatchEvent("selenium." + json.name, json.event);
                    break;
            }
            
        }, false);
        
        ide.addEventListener("selenium.record", function(e){
            var nr = _self.model.queryNodes("test").length + 1;
            var doc = _self.model.data.ownerDocument;
            
            var testNode = doc.createElement("test");
            testNode.setAttribute("name", "Test recording " + nr);
            
            dgUiRecorder.add(testNode);
            
            if (brSeleniumPreview.src
              && _self.findUrl(_self.model.queryNode("test[last()]")) != brSeleniumPreview.src)
                _self.getNewUrl(brSeleniumPreview.src);
            
            //dgUiRecorder.select(testNode);
        });
        ide.addEventListener("selenium.stop", function(e){
            var nodes = _self.model.queryNodes("test[last()]/action");
            for (var i = 0; i < nodes.length; i++) {
                nodes[i].setAttribute("json", 
                    JSON.stringify(e.actions[nodes[i].getAttribute("index")]));
            }
        });
        ide.addEventListener("selenium.action", function(e){
            if (e.stream.name == "mousemove")
                return;
            
            var doc = _self.model.data.ownerDocument;
            
            var actionNode = doc.createElement("action");
            actionNode.setAttribute("name", e.stream.name);
            actionNode.setAttribute("element", JSON.stringify(e.stream.element));
            actionNode.setAttribute("index", e.streamIndex);
            actionNode.setAttribute("value", e.stream.value || "");
            
            _self.model.appendXml(actionNode, "test[last()]");
        });
        ide.addEventListener("selenium.capture.http", function(e){
            
        });
        ide.addEventListener("selenium.capture.prop", function(e){
            if (!e.stream.name || e.stream.name == "mousemove")
                return;
        
            if (JSON.stringify(e.prop.value).indexOf("Could not serialize") > -1)
                return;
        
            var doc         = _self.model.data.ownerDocument;
            var index       = e.streamIndex;
            
            var assertNode  = doc.createElement("assert");
            assertNode.setAttribute("element", JSON.stringify(e.prop.element));
            assertNode.setAttribute("name", e.prop.name);
            assertNode.setAttribute("value", JSON.stringify(e.prop.value));
            assertNode.setAttribute("json", JSON.stringify(e.prop));
            
            _self.model.appendXml(assertNode, "test[last()]/action[@index=" + index + "]");
        });
        ide.addEventListener("selenium.capture.event", function(e){
            if ("dragstop|dragdrop".indexOf(e.event.name) > -1) {
                _self.model.setQueryValue("test[last()]/action[@index=" 
                  + e.streamIndex + "]/@element", 
                    JSON.stringify(e.stream.element));
            }
        });
        ide.addEventListener("selenium.capture.data", function(e){
            
        });
        
        ide.addEventListener("hidemenu", function(e){
            _self.hidePropertyMenu(e);
        });
        ide.addEventListener("showmenu", function(e){
            _self.showPropertyMenu(e);
        });
        
        this.model = new apf.model();
        this.model.$ignoreRecorder = true;
        this.model.load("<tests></tests>");
        
        dgUiRecorder.setModel(this.model);
        
        this.iframe = brSeleniumPreview.$browser;
        this.target = this.iframe.contentWindow;
        
        brSeleniumPreview.addEventListener("load", function(){
            _self.inject();
        });
        
        /**** Preview ****/
        
        tbUiRecordLoc.addEventListener("keydown", function(e){
            if (event.keyCode == 13) 
                brSeleniumPreview.setAttribute('src', this.value);
            else if (event.keyCode == 27) 
                this.setValue(brSeleniumPreview.src);
        });
        
        brSeleniumPreview.addEventListener("load", function(e){
            tbUiRecordLoc.setValue(e.href);
        });
        
        dgUiRecorder.addEventListener("afterselect", function(){
            if (this.selected) {
                var value;
                if ("repo|file".indexOf(this.selected.localName) > -1)
                    value = apf.queryValue(this.selected, ".//action[@name='get']/@value");
                else
                    value = _self.findUrl(this.selected);
                
                if (value)
                    brSeleniumPreview.setAttribute("src", value);
            }
        });
    },
    
    findUrl : function(xmlNode){
        var url, testNode = xmlNode.selectSingleNode("ancestor-or-self::test");
        while (!url && testNode) {
            url = apf.queryValue(testNode, "action[@name='get']/@value");
            if (!url)
                testNode = testNode.selectSingleNode("preceding-sibling::test");
        }
        
        return url;
    },

    inject : function() {
        this.connected = 0;
        
        var head = this.target.document.documentElement;
        elScript = this.target.document.createElement("script");
        elScript.src = "http://127.0.0.1:5001/workspace/client/ext/selenium/injection.js";
        head.appendChild(elScript);
    
        var _self = this;
        clearInterval(this.$timer);
        this.$timer = setInterval(function(){
            _self.execute("ping");
        }, 100);
    },
    
    execute : function(cmd, arg1){
        this.target.postMessage({
            command : cmd,
            args    : [arg1]
        }, "*");
    },
    
    pong : function(){
        if (this.connected == 1)    
            return;
        
        this.connected = 1;
        clearInterval(this.$timer);
        
        if (this.isRecording)
            this.start();
    },
    
    start : function(){
        if (!brSeleniumPreview.src)
            return util.alert("Missing page",
                "Please load a page first",
                "Fill in a url to the page to test in the textbox and press enter");
                
        
        if (this.connected == 2)
            return;
        
        if (this.connected == 1 && !this.target.capture)
            this.connected = 3;
        
        if (this.connected != 1) {
            this.inject();
            
            this.connected = 2;
            
            return;
        }
        
        this.isRecording = true;
        
        this.execute("record");

        btnUiRecordStart.hide();
        btnUiRecordStop.show();
//        btnUiRecordStart.disable();
//        btnUiRecordStop.enable();
    },
    
    stop : function(){
        this.execute("stop");
        
        btnUiRecordStart.show();
        btnUiRecordStop.hide();
//        btnUiRecordStart.enable();
//        btnUiRecordStop.disable();
        
//        btnUiRecordRun.setAttribute("disabled", 
//            !apf.uirecorder.capture.actions.length);

        this.isRecording = false;
    },
    
    getNewUrl : function(url){
        var doc = this.model.data.ownerDocument;
        var actionNode = doc.createElement("action");
        actionNode.setAttribute("name", "get");
        actionNode.setAttribute("value", url);
        
        this.model.appendXml(actionNode, "test[last()]");
    },
    
    startAddAssert : function(){
        this.execute("startAddAssert");
        
        barUiRecorder.disable();
    },
    
    stopAddAssert : function(){
        this.execute("stopAddAssert");
        
        barUiRecorder.enable();
    },
    
    highlightElement : function(e) {
        var xmlNode = apf.xmldb.findXmlNode(e.htmlEvent.srcElement || e.htmlEvent.target);
        if (!xmlNode)
            return;
        
        var url = this.findUrl(xmlNode);
        if (url != brSeleniumPreview.src)
            return;
        
        var element = xmlNode.getAttribute("element");
        if (!element)
            return;

        try { var elObj = JSON.parse(element); }catch(e){}
        if (!elObj)
            return;
        
        var json = xmlNode.getAttribute("json");
        elObj.json = json && JSON.parse(json);
        
        this.execute("highlightElement", elObj);
    },
    
    hideHighlightElements : function(){
        this.execute("hideHighlightElements");
    },
    
    hidePropertyMenu : function(){
        if (this.menu)
            this.menu.destroy(true, true);
    },
    
    showPropertyMenu : function(e){
        var ui = this;
        
        var element = e.element;
        
        this.menu = apf.document.body.appendChild(new apf.menu());
        this.menu.$ignoreRecorder = true;
        this.menu.addEventListener("itemclick", function(e){
            if (dgUiRecorder.selected) {
                var node = dgUiRecorder.selected;
                if (node.localName == "assert")
                    node = node.parentNode;
                
                var doc = node.ownerDocument;
                var assert = doc.createElement("assert");
                assert.setAttribute("name", e.relatedNode.caption);
                assert.setAttribute("value", JSON.stringify(e.relatedNode.value));
                assert.setAttribute("element", JSON.stringify(element));
                
                apf.xmldb.appendChild(node, assert);
                
                dgUiRecorder.select(assert);
            }
            
            ui.stopAddAssert();
        });
        
        var props = e.props;
        for (var prop, i = 0; i < props.length; i++) {
            this.menu.appendChild(new apf.item({
                caption : props[i].caption,
                value   : props[i].value
            }));
        }
        
        var pos = apf.getAbsolutePosition(this.iframe);
        this.menu.display(pos[0] + e.x, pos[1] + e.y);
    },
    
    write : function(){
        var tests = this.getTests();
        
        //Write to server
        
        console.dir(tests);
    },
    
    getTests : function(compiled){
        var model = this.model;
        var nodes = model.queryNodes("test");
        
        var sp = new SeleniumPlayer();
        sp.realtime = false;
        
        var test, tests = {}, actions, action, asserts, assert;
        for (var i = 0; i < nodes.length; i++) {
            actions = apf.queryNodes(nodes[i], "action");
            
            test = [];
            for (var j = 0; j < actions.length; j++) {
                action = JSON.parse(actions[j].getAttribute("json"));
                action.name = actions[j].getAttribute("name");
                action.value = actions[j].getAttribute("value");
                
                action.properties = [];
                
                asserts = apf.queryNodes(actions[j], "assert");
                for (var k = 0; k < asserts.length; k++) {
                    assert = JSON.parse(asserts[k].getAttribute("json")) || {};
                    
                    assert.element = JSON.parse(asserts[k].getAttribute("element"))
                    assert.value   = JSON.parse(asserts[k].getAttribute("value")) //@todo potential problem with newlines in content
                    assert.name    = asserts[k].getAttribute("name"); 
                    
                    action.properties.push(assert);
                }
                
                test.push(action);
            }
            
            tests[nodes[i].getAttribute("name")] = !compiled ? test : sp.compile(test);
        }
        
        return tests;
    },
    
    convertToXml : function(tests) {
        var testNode, actionNode, assertNode;
        var test, action, name, property, propName;
        var xml = apf.getXml("<tests />");
        var doc = xml.ownerDocument;
        
        // Tests
        for (name in tests) {
            if (!name.match(/^test /i))
                continue;
            
            testNode = xml.appendChild(doc.createElement("test"));
            testNode.setAttribute("name", name);
            
            test = tests[name];
            
            // Actions
            for (var i = 0; i < test.length; i++) {
                action = test[i];
                
                actionNode = doc.createElement("action");
                actionNode.setAttribute("name", action.name);
                actionNode.setAttribute("element", JSON.stringify(action.element));
                actionNode.setAttribute("index", i);
                actionNode.setAttribute("value", action.value || "");
                actionNode.setAttribute("json", JSON.stringify(action));
                
                if (action.properties) {
                    for (var j = 0; j < action.properties.length; j++) {
                        property = action.properties[j];
                        
                        assertNode  = doc.createElement("assert");
                        assertNode.setAttribute("element", JSON.stringify(property.element));
                        assertNode.setAttribute("name", property.name);
                        assertNode.setAttribute("value", JSON.stringify(property.value));
                        assertNode.setAttribute("json", JSON.stringify(property));
                        
                        actionNode.appendChild(assertNode);
                    }
                }
                
                testNode.appendChild(actionNode);
            }
        }
        
        return xml;
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
        
        if (self.mainUiRecorder) {
            mainUiRecorder.destroy(true, true);
        }

        this.nodes = [];
    }
});

});
