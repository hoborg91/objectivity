
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\GuidelineChunk.svelte generated by Svelte v3.37.0 */

    const file$1 = "src\\GuidelineChunk.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (7:4) {#if guideline.imgLink}
    function create_if_block_2(ctx) {
    	let div;
    	let a;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let img_title_value;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			img = element("img");
    			if (img.src !== (img_src_value = /*guideline*/ ctx[0].imgLink)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*guideline*/ ctx[0].imgDescription);
    			attr_dev(img, "title", img_title_value = /*guideline*/ ctx[0].imgDescription);
    			attr_dev(img, "width", "200");
    			add_location(img, file$1, 8, 38, 179);
    			attr_dev(a, "href", a_href_value = /*guideline*/ ctx[0].imgLink);
    			add_location(a, file$1, 8, 8, 149);
    			attr_dev(div, "class", "img-common svelte-6rsoyt");
    			add_location(div, file$1, 7, 4, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			append_dev(a, img);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*guideline*/ 1 && img.src !== (img_src_value = /*guideline*/ ctx[0].imgLink)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*guideline*/ 1 && img_alt_value !== (img_alt_value = /*guideline*/ ctx[0].imgDescription)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*guideline*/ 1 && img_title_value !== (img_title_value = /*guideline*/ ctx[0].imgDescription)) {
    				attr_dev(img, "title", img_title_value);
    			}

    			if (dirty & /*guideline*/ 1 && a_href_value !== (a_href_value = /*guideline*/ ctx[0].imgLink)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(7:4) {#if guideline.imgLink}",
    		ctx
    	});

    	return block;
    }

    // (13:0) {#if guideline.bestPractices}
    function create_if_block(ctx) {
    	let each_1_anchor;
    	let each_value = /*guideline*/ ctx[0].bestPractices;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*guideline*/ 1) {
    				each_value = /*guideline*/ ctx[0].bestPractices;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(13:0) {#if guideline.bestPractices}",
    		ctx
    	});

    	return block;
    }

    // (21:20) {#if bestPractices.imgLink}
    function create_if_block_1(ctx) {
    	let div;
    	let a;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let img_title_value;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			img = element("img");
    			if (img.src !== (img_src_value = /*bestPractices*/ ctx[1].imgLink)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*bestPractices*/ ctx[1].imgDescription);
    			attr_dev(img, "title", img_title_value = /*bestPractices*/ ctx[1].imgDescription);
    			attr_dev(img, "width", "200");
    			add_location(img, file$1, 22, 58, 774);
    			attr_dev(a, "href", a_href_value = /*bestPractices*/ ctx[1].imgLink);
    			add_location(a, file$1, 22, 24, 740);
    			add_location(div, file$1, 21, 20, 709);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a);
    			append_dev(a, img);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*guideline*/ 1 && img.src !== (img_src_value = /*bestPractices*/ ctx[1].imgLink)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*guideline*/ 1 && img_alt_value !== (img_alt_value = /*bestPractices*/ ctx[1].imgDescription)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*guideline*/ 1 && img_title_value !== (img_title_value = /*bestPractices*/ ctx[1].imgDescription)) {
    				attr_dev(img, "title", img_title_value);
    			}

    			if (dirty & /*guideline*/ 1 && a_href_value !== (a_href_value = /*bestPractices*/ ctx[1].imgLink)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(21:20) {#if bestPractices.imgLink}",
    		ctx
    	});

    	return block;
    }

    // (14:0) {#each guideline.bestPractices as bestPractices}
    function create_each_block$1(ctx) {
    	let div2;
    	let table;
    	let tbody;
    	let tr;
    	let td0;
    	let div0;
    	let t1;
    	let td1;
    	let t2;
    	let div1;
    	let t3_value = /*bestPractices*/ ctx[1].message + "";
    	let t3;
    	let t4;
    	let small;
    	let a;
    	let t5_value = /*bestPractices*/ ctx[1].linkCaption + "";
    	let t5;
    	let t6;
    	let t7_value = /*bestPractices*/ ctx[1]?.linkHref + "";
    	let t7;
    	let a_href_value;
    	let t8;
    	let if_block = /*bestPractices*/ ctx[1].imgLink && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			table = element("table");
    			tbody = element("tbody");
    			tr = element("tr");
    			td0 = element("td");
    			div0 = element("div");
    			div0.textContent = "👑";
    			t1 = space();
    			td1 = element("td");
    			if (if_block) if_block.c();
    			t2 = space();
    			div1 = element("div");
    			t3 = text(t3_value);
    			t4 = space();
    			small = element("small");
    			a = element("a");
    			t5 = text(t5_value);
    			t6 = text(" | ");
    			t7 = text(t7_value);
    			t8 = space();
    			attr_dev(div0, "title", "Пример для подражания");
    			attr_dev(div0, "class", "best-practices-sign");
    			add_location(div0, file$1, 18, 46, 533);
    			attr_dev(td0, "class", "best-practices-td svelte-6rsoyt");
    			add_location(td0, file$1, 18, 16, 503);
    			attr_dev(div1, "class", "best-practices-message");
    			add_location(div1, file$1, 25, 20, 975);
    			attr_dev(a, "href", a_href_value = /*bestPractices*/ ctx[1]?.linkHref);
    			add_location(a, file$1, 26, 60, 1102);
    			attr_dev(small, "class", "best-practices-reference");
    			add_location(small, file$1, 26, 20, 1062);
    			add_location(td1, file$1, 19, 16, 634);
    			add_location(tr, file$1, 17, 12, 481);
    			add_location(tbody, file$1, 16, 8, 460);
    			add_location(table, file$1, 15, 4, 443);
    			attr_dev(div2, "class", "best-practices-div svelte-6rsoyt");
    			add_location(div2, file$1, 14, 0, 405);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, table);
    			append_dev(table, tbody);
    			append_dev(tbody, tr);
    			append_dev(tr, td0);
    			append_dev(td0, div0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			if (if_block) if_block.m(td1, null);
    			append_dev(td1, t2);
    			append_dev(td1, div1);
    			append_dev(div1, t3);
    			append_dev(td1, t4);
    			append_dev(td1, small);
    			append_dev(small, a);
    			append_dev(a, t5);
    			append_dev(a, t6);
    			append_dev(a, t7);
    			append_dev(div2, t8);
    		},
    		p: function update(ctx, dirty) {
    			if (/*bestPractices*/ ctx[1].imgLink) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(td1, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*guideline*/ 1 && t3_value !== (t3_value = /*bestPractices*/ ctx[1].message + "")) set_data_dev(t3, t3_value);
    			if (dirty & /*guideline*/ 1 && t5_value !== (t5_value = /*bestPractices*/ ctx[1].linkCaption + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*guideline*/ 1 && t7_value !== (t7_value = /*bestPractices*/ ctx[1]?.linkHref + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*guideline*/ 1 && a_href_value !== (a_href_value = /*bestPractices*/ ctx[1]?.linkHref)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(14:0) {#each guideline.bestPractices as bestPractices}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let t0_value = /*guideline*/ ctx[0].message + "";
    	let t0;
    	let t1;
    	let t2;
    	let if_block1_anchor;
    	let if_block0 = /*guideline*/ ctx[0].imgLink && create_if_block_2(ctx);
    	let if_block1 = /*guideline*/ ctx[0].bestPractices && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block0) if_block0.c();
    			t2 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			add_location(div, file$1, 4, 0, 50);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			if (if_block0) if_block0.m(div, null);
    			insert_dev(target, t2, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*guideline*/ 1 && t0_value !== (t0_value = /*guideline*/ ctx[0].message + "")) set_data_dev(t0, t0_value);

    			if (/*guideline*/ ctx[0].imgLink) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					if_block0.m(div, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*guideline*/ ctx[0].bestPractices) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (detaching) detach_dev(t2);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("GuidelineChunk", slots, []);
    	let { guideline } = $$props;
    	const writable_props = ["guideline"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<GuidelineChunk> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("guideline" in $$props) $$invalidate(0, guideline = $$props.guideline);
    	};

    	$$self.$capture_state = () => ({ guideline });

    	$$self.$inject_state = $$props => {
    		if ("guideline" in $$props) $$invalidate(0, guideline = $$props.guideline);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [guideline];
    }

    class GuidelineChunk extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { guideline: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GuidelineChunk",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*guideline*/ ctx[0] === undefined && !("guideline" in props)) {
    			console.warn("<GuidelineChunk> was created without expected prop 'guideline'");
    		}
    	}

    	get guideline() {
    		throw new Error("<GuidelineChunk>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set guideline(value) {
    		throw new Error("<GuidelineChunk>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var data = [{topic:"В архитектуре применяют простые геометрические решения.",west:{message:"Смелое инновационное решение от ведущих мировых архитекторов.",bestPractices:[{message:"Это Национальный оперный театр, его построили в 2007 году по проекту норвежского архитектурного бюро Snøhetta, который выбрали среди 200 других работ, присланных со всего мира.",imgLink:"https://varlamov.me/2019/oslo/15.jpg",imgDescription:"Оперный театр Осло. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/3550200.html",linkCaption:"И. Варламов. Как живут самые счастливые люди в мире. 8 августа 2019"}]},russia:{message:"Безобразная брежневская коробка, прекрасно символизирующая врождённое уныние гражданского общества.",imgLink:"https://дк-яуза.рф/images/gallery/foto/1/11.jpg",imgDescription:"Мытищинский Дворец культуры «Яуза». Источник: http://дк-яуза.рф."}},{topic:"При строительстве пользуются яркими и пёстрыми красками.",west:{message:"Яркое и жизнерадостное решение с грамотно подобранными цветами.",bestPractices:[{message:"Здание может быть ярким, может быть вызывающе ярким и пёстрым.",imgLink:"https://varlamov.me/2018/stockholm_newray/07.jpg",imgDescription:"Многоквартирный жилой дом в Стокгольме. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/2909504.html",linkCaption:"И. Варламов. Новые районы Стокгольма. Хотели бы так жить? 7 мая 2018"},{message:"...Хороший пример как надо работать с цветом в архитектуре. С одной стороны, мы получаем яркое пятно в районе. С другой, этот дом не раздражает, его цвета подобраны очень грамотно.",imgLink:"https://varlamov.me/2019/kopenhagen_newrai/06.jpg",imgDescription:"Многоквартирный жилой дом в Копенгагене. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/3577999.html",linkCaption:"И. Варламов. Новые районы Копенгагена: деревья, каналы, велосипеды. 1 сентября 2019"}]},russia:{message:"Пёстрое разноцветное говно.",bestPractices:[{message:"Когда наши колхозники пытаются работать с цветом, почти гарантировано получается говно.",imgLink:"https://varlamov.me/2015/sahalin_ploh/46.jpg",imgDescription:"Многоквартирный жилой дом в неустановленном регионе России. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/1973591.html",linkCaption:"И. Варламов. Чем опасны цветные дома. 23 сентября 2016"},{message:"Вот скажите мне, как можно объяснить появление в Санкт-Петербурге [...] вот этого пёстрого разноцветного говна?",imgLink:"https://varlamov.me/2017/new_ohta/00s.jpg",imgDescription:"Многоквартирный жилой дом в Санкт-Петербурге. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/2202685.html",linkCaption:"И. Варламов. Жуткий Петербург: ЖК \"Новая Охта\". 25 января 2017"}]}},{topic:"При строительстве пользуются серыми и ненасыщенными красками.",west:{message:"Спокойное и выдержанное, не кричащее решение."},russia:{message:"Тлен и безысходность в архитектуре точно отражают серость народной массы.",bestPractices:[{message:"Все испоганили серой краской.",linkHref:"https://varlamov.ru/1396072.html",linkCaption:"И. Варламов. Уфа заиграла новыми красками. 6 июля 2015"}]}},{topic:"Бывшие культовые сооружения приспосабливают для новых нужд.",west:{message:"Воспитанные и просвещённые граждане идут в ногу со временем.",bestPractices:[{message:"...Группа энтузиастов смогла [церковь] восстановить и превратить в скейтпарк. Стены внутри бывшей церкви расписал художник Окуда Сан Мигель. Он оформил их разноцветными геометрическими фигурами и радугами. Когда солнце сквозь окна освещает внутреннее помещение скейтпарка, здесь становится очень ярко и красиво.",imgLink:"https://varlamov.me/2016/church/42.jpg",imgDescription:"Бывшая церковь святой Варвары в Льянере, Испания. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/1795206.html",linkCaption:"И. Варламов. Ничего святого: что европейцы делают с церквями. 21 июня 2016"}]},russia:{message:"Кровавые жидобольшевики варварски надругались над русской культурой.",bestPractices:[{message:"Но потом пришли большевики и начали взрывать и переделывать храмы по всей стране. Курская кирха в 1938 году лишилась колокольни. Тут заработал радиоклуб.",imgLink:"https://varlamov.me/2019/prokursk/03.jpg",imgDescription:"Бывшая лютеранская церковь в Курске. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/3693819.html",linkCaption:"И. Варламов. Как проебать церковь: инструкция из Курска. 3 декабря 2019"},{message:"Храмы быстро кастрировали, попов разогнали. Каким-то церквям повезло, они стали музеями и сохранились до наших дней. А каким-то нет, их взорвали и уничтожили. Большинство же перестроили и наполнили новыми смыслами – а чего добру пропадать? [...] В Европе и США есть практика, когда бывшие храмы переделывают под новые функции. В шикарных интерьерах могут расположиться отели, библиотеки, даже бары и пивоварни. Но в России такое вряд ли возможно.",imgLink:"https://varlamov.me/2020/hramy/18.jpg",imgDescription:"Бывшая церковь в неустановленном регионе России. Источник: http://varlamov.ru.",linkHref:"https://varlamov.ru/3901473.html",linkCaption:"И. Варламов. Кому нужны эти храмы? 22 мая 2020"}]}},{topic:"Строят новые культовые сооружения.",west:{message:"Воспитанные и просвещённые граждане сохраняют свою культуру и уважают историческое наследние."},russia:{message:"Попы, получившие от власти карт-бланш на одурманивание народа, совсем оборзели."}},{topic:"Одна и та же группа людей долго находится у власти.",west:{message:"Пользуясь отлаженными демократическими процедурами свободный народ выбрал стабильность и уверенность в завтрашнем дне.",imgLink:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Visita_de_Estado_de_Angela_Merkel_-i---i-_%2834475803663%29.jpg/640px-Visita_de_Estado_de_Angela_Merkel_-i---i-_%2834475803663%29.jpg",imgDescription:"Прьемьер-министр Германии А. Меркель. Источник: Wikimedia Commons.",bestPractices:[{message:"Образ Меркель [...] уже давно стал символом стабильности и умеренной, тщательно продуманной политики.",linkHref:"https://www.youtube.com/watch?v=tjDprMHur3Q&t=1536s",linkCaption:"М. Кац в YouTube. Меркель. Новая «Железная леди» Европы. 23 дек. 2020 г."}]},russia:{message:"Закостеневшая геронтократическая клика держится на штыках и лживой государственной пропаганде.",imgLink:"https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/PresidentPutin.JPG/640px-PresidentPutin.JPG",imgDescription:"Президент России В. Путин. Источник: Wikimedia Commons.",bestPractices:[{message:"Важная скрепа Путинской системы управления — начальники уходят с должности только вперёд ногами. Сменяемость не соответствует нашему особому пути.",linkHref:"https://twitter.com/max_katz/status/1386008169747464195",linkCaption:"М. Кац в Twitter. 24 апр. 2021 г."}]}},{topic:"Контролируют сердства связи и автоматически распознают лица на записях с камер наружного наблюдения.",west:{message:"Беспрецедентные меры по повышению уличной безопасности станут одним из краеугольных камней сверхсовременного законопослушного общества."},russia:{message:"Тоталитарное репрессивное государство закручивает гайки с целью выжать из собственных граждан последние соки."}},{topic:"В сражении солдаты проявляют чудеса отваги и стойко держат натиск врага.",west:{message:"Настоящие, верные своему долгу патриоты, отваге которых мы можем лишь завидовать.",imgLink:"https://upload.wikimedia.org/wikipedia/commons/0/0b/Robert_Gibb_-_The_Thin_Red_Line.jpg",imgDescription:"Р. Гибб. Тонкая красная линия. Источник: Wikimedia Commons."},russia:{message:"Бездарные военачальники закидывают врага трупами своих жалких соотечественников.",bestPractices:[{message:"Вот вам качество маршалов и генералов, стратегии и тактики. Мясники, гнавшие солдат на убой! Русская баба еще нарожает, хрен ли людей жалеть?!",linkHref:"https://twitter.com/gudkov_g/status/1390344326513889283",linkCaption:"Г. Гудков в Twitter. 6 мая 2021 г."}]}},{topic:"Заключают договор со злонамернным вероятным противником.",west:{message:"По-благородному наивные рыцари запада хотели только хорошего, но их обманули вероломные русские.",bestPractices:[{message:"Позволю себе нарушить 76-летную традицию поношения данного соглашения и изложить некие доводы в его защиту. [...] Не был учтен союз Гитлера и Сталина, которые осенью 1938 бранились похлеще, чем Россия с Украиной сейчас. Такой подлости даже «мюнхенские предатели» не ждали.",linkHref:"https://szona.org/o-myunhenskom-sgovore-odna-hitrost-dve-podlosti/index.html",linkCaption:"Е. Ихлов. О «Мюнхенском сговоре»: Одна хитрость и две подлости. 11 февраля 2015. (Свободная Зона)"}]},russia:{message:"Это было величайшее преступление против человечества за всю историю, в которым виноваты именно и только русские.",bestPractices:[{message:"Мы принесли кровь и страдание многим народам и своему, разумеется, в первую очередь. Но и многим народам Европы. Мы несем полную ответственность за развязывание – СССР — Второй мировой войны.",linkHref:"https://echo.msk.ru/programs/personalno/2833422-echo/",linkCaption:"В. Шендерович. Особое мнение. 06 мая 2021."}]}},{topic:"Государство проводит обширную программу социальной помощи.",west:{message:"Вот это правильно; так хорошо, когда общество заботится о каждом своём члене!"},russia:{message:"Какой кошмар; да сколько же мы будем избавляться от патернализма и других наследственных пятен совка!?",bestPractices:[{message:"Если мы от патернализма будем потихонечку отруливать, а каждый человек поймёт, что его судьба прежде всего в его собственных руках, — заметил глава государства, — это будет очень правильным направлением в работе с молодыми людьми.",linkHref:"https://ria.ru/20170622/1497066798.html",linkCaption:"В. Путин на встрече с классными руководителями старшеклассников. РИА Новости. 22.06.2017."}]}},{topic:"Компания цензурирует сообщения своих пользователей.",west:{message:"Эта цензура — кого надо цензура.",bestPractices:[{message:"Бан Трампа не имеет никакого отношения к свободе слова. [...] Никому не даровано право писать в твиттер, это частная организация которая может, но не обязана предоставлять площадку",linkHref:"https://twitter.com/max_katz/status/1347701366903500804",linkCaption:"М. Кац в Twitter. 9 янв. 2021 г."}]},russia:{message:"Настанет ли день, когда в России избавятся от вечной своей привычки затыкать рот всем добрым людям!?"}},{topic:"Школьная форма.",west:{message:"Ученики гордятся своей школьной формой.",imgLink:"https://condenast-media.gcdn.co/tatler/aee49892aa8bae504cf7fb608243b221.jpg/e815bb97/o/t5077x3506",imgDescription:"Александр Солженицын на встрече с учащимися Итонского колледжа, 1983 год. Источник: tatler.ru, pinterest.ru."},russia:{message:"Школьная форма — это символ зловещего тоталитаризма.",bestPractices:[{message:"In the late Soviet period, the school uniform was perceived by many as an element of the totalitarian system and a tool for suppressing individuality.",imgLink:"https://cdni.rbth.com/rbthmedia/images/all/2017/09/09_hbi52b30d2389b14_1024_b.jpg",imgDescription:"Советские школьники. Источник: Semen Frindlaynd/MAMM/russiainphoto.ru",linkHref:"https://www.rbth.com/arts/history/2017/09/01/how-soviet-children-struggled-with-symbol-of-totalitarism-the-school_832282",linkCaption:"Margarita Lindt. How Soviet children struggled with the symbol of totalitarism - school uniform. Russia Beyond. Sept 01 2017"}]}},{topic:"Рабство отменяют после 1860 г.",west:{message:"Свободолюбивые американцы враз расправились с ненавистным пережитком, разделив со своими ближними важнейшие демократические ценности."},russia:{message:"Из-за отвратительного института лаптей и лохмотьев, за которые до последнего цеплялась звероподобная русня, миллионы влачили жалкое существование.",bestPractices:[{message:"Подземка Нью-Йорка — одна из самых старых в мире. Первый поезд был пущен тогда, когда у нас отменили крепостное право — в середине XIX в.",linkHref:"https://www.youtube.com/watch?v=P_g10-9Y2eY&t=294s",linkCaption:"Орёл и Решка - 1 Выпуск НЬЮ-ЙОРК"}]}}];

    var data$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': data
    });

    /* src\App.svelte generated by Svelte v3.37.0 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (25:2) {#each guidelines as guideline}
    function create_each_block(ctx) {
    	let tr;
    	let td0;
    	let t0_value = (/*guideline*/ ctx[1].topic || "") + "";
    	let t0;
    	let t1;
    	let td1;
    	let guidelinechunk0;
    	let t2;
    	let td2;
    	let guidelinechunk1;
    	let t3;
    	let current;

    	guidelinechunk0 = new GuidelineChunk({
    			props: { guideline: /*guideline*/ ctx[1].west },
    			$$inline: true
    		});

    	guidelinechunk1 = new GuidelineChunk({
    			props: { guideline: /*guideline*/ ctx[1].russia },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			td0 = element("td");
    			t0 = text(t0_value);
    			t1 = space();
    			td1 = element("td");
    			create_component(guidelinechunk0.$$.fragment);
    			t2 = space();
    			td2 = element("td");
    			create_component(guidelinechunk1.$$.fragment);
    			t3 = space();
    			attr_dev(td0, "class", "topic-td svelte-w0oe7g");
    			add_location(td0, file, 26, 3, 1049);
    			attr_dev(td1, "class", "svelte-w0oe7g");
    			add_location(td1, file, 27, 3, 1102);
    			attr_dev(td2, "class", "svelte-w0oe7g");
    			add_location(td2, file, 28, 3, 1159);
    			add_location(tr, file, 25, 2, 1041);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			append_dev(tr, td0);
    			append_dev(td0, t0);
    			append_dev(tr, t1);
    			append_dev(tr, td1);
    			mount_component(guidelinechunk0, td1, null);
    			append_dev(tr, t2);
    			append_dev(tr, td2);
    			mount_component(guidelinechunk1, td2, null);
    			append_dev(tr, t3);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(guidelinechunk0.$$.fragment, local);
    			transition_in(guidelinechunk1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(guidelinechunk0.$$.fragment, local);
    			transition_out(guidelinechunk1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_component(guidelinechunk0);
    			destroy_component(guidelinechunk1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(25:2) {#each guidelines as guideline}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let h1;
    	let t1;
    	let div0;
    	let span0;
    	let t3;
    	let t4;
    	let table;
    	let thead;
    	let tr;
    	let th0;
    	let t6;
    	let th1;
    	let t8;
    	let th2;
    	let t10;
    	let tbody;
    	let t11;
    	let div1;
    	let span1;
    	let t13;
    	let t14;
    	let div2;
    	let span2;
    	let t16;
    	let a0;
    	let t18;
    	let a1;
    	let t20;
    	let a2;
    	let t22;
    	let current;
    	let each_value = /*guidelines*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			h1.textContent = "Пиши правильно!";
    			t1 = space();
    			div0 = element("div");
    			span0 = element("span");
    			span0.textContent = "Что это за страница?";
    			t3 = text(" Бывает, перед честным русским либералом встаёт непростая задача осветить сложные и противоречивые тенденции современного общества. \n\tСледует помнить, что методы освещения существенно зависят от местности, в которой происходят события. \n\tС целью облегчить добросовестный труд благожелателей, на этой странице в форме шпаргалки собраны указания на то, в каких выражениях следует изъясняться и на чём следует акцентировать внимание при написании новостей и заметок. \n\tНекоторые указания удалось снабдить подходящими примерами, найденными у корифеев пера и «Ютьюба».");
    			t4 = space();
    			table = element("table");
    			thead = element("thead");
    			tr = element("tr");
    			th0 = element("th");
    			th0.textContent = "Тема";
    			t6 = space();
    			th1 = element("th");
    			th1.textContent = "Если речь идёт о западной Европе, США и Канаде";
    			t8 = space();
    			th2 = element("th");
    			th2.textContent = "Если речь идёт о России";
    			t10 = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t11 = space();
    			div1 = element("div");
    			span1 = element("span");
    			span1.textContent = "И помните!";
    			t13 = text(" \n\tВ некоторых случаях полезно делать отдельные уступки и оговорки; не нужно, чтобы под натиском неприятной правды читатель или зритель отказался воспринимать материал. \n\tПостарайтесь доказать, что вы все силы прикладываете к тому, чтобы объективно исследовать ситуацию, ведь так и есть на самом деле! \n\tК сожалению, волшебная фраза «Это другое!» была в последнее время дискредетирована плохо подготовленными благожелателями. \n\tОт вас потребуется изобрести несколько более продуманный подход к чувствам потребителей.");
    			t14 = space();
    			div2 = element("div");
    			span2 = element("span");
    			span2.textContent = "Как дополнить?";
    			t16 = text(" \n\tИсходный код проекта находится по адресу ");
    			a0 = element("a");
    			a0.textContent = "https://github.com/hoborg91/rp-guidelines";
    			t18 = text(". \n\tМожно либо ");
    			a1 = element("a");
    			a1.textContent = "отправить свои изменения в коде";
    			t20 = text(", либо ");
    			a2 = element("a");
    			a2.textContent = "создать запрос";
    			t22 = text(".");
    			attr_dev(h1, "class", "svelte-w0oe7g");
    			add_location(h1, file, 6, 0, 147);
    			attr_dev(span0, "class", "faq-question svelte-w0oe7g");
    			add_location(span0, file, 9, 1, 196);
    			attr_dev(div0, "class", "faq-div svelte-w0oe7g");
    			add_location(div0, file, 8, 0, 173);
    			attr_dev(th0, "class", "svelte-w0oe7g");
    			add_location(th0, file, 18, 3, 869);
    			attr_dev(th1, "class", "svelte-w0oe7g");
    			add_location(th1, file, 19, 3, 886);
    			attr_dev(th2, "class", "svelte-w0oe7g");
    			add_location(th2, file, 20, 3, 945);
    			add_location(tr, file, 17, 2, 861);
    			add_location(thead, file, 16, 1, 851);
    			add_location(tbody, file, 23, 1, 997);
    			attr_dev(table, "class", "main-table svelte-w0oe7g");
    			add_location(table, file, 15, 0, 823);
    			attr_dev(span1, "class", "faq-question svelte-w0oe7g");
    			add_location(span1, file, 35, 1, 1276);
    			attr_dev(div1, "class", "faq-div svelte-w0oe7g");
    			add_location(div1, file, 34, 0, 1253);
    			attr_dev(span2, "class", "faq-question svelte-w0oe7g");
    			add_location(span2, file, 43, 1, 1870);
    			attr_dev(a0, "href", "https://github.com/hoborg91/rp-guidelines");
    			add_location(a0, file, 44, 42, 1962);
    			attr_dev(a1, "href", "https://github.com/hoborg91/rp-guidelines/pulls");
    			add_location(a1, file, 45, 12, 2074);
    			attr_dev(a2, "href", "https://github.com/hoborg91/rp-guidelines/issues");
    			add_location(a2, file, 45, 112, 2174);
    			attr_dev(div2, "class", "faq-div svelte-w0oe7g");
    			add_location(div2, file, 42, 0, 1847);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div0, anchor);
    			append_dev(div0, span0);
    			append_dev(div0, t3);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, table, anchor);
    			append_dev(table, thead);
    			append_dev(thead, tr);
    			append_dev(tr, th0);
    			append_dev(tr, t6);
    			append_dev(tr, th1);
    			append_dev(tr, t8);
    			append_dev(tr, th2);
    			append_dev(table, t10);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			insert_dev(target, t11, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, span1);
    			append_dev(div1, t13);
    			insert_dev(target, t14, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, span2);
    			append_dev(div2, t16);
    			append_dev(div2, a0);
    			append_dev(div2, t18);
    			append_dev(div2, a1);
    			append_dev(div2, t20);
    			append_dev(div2, a2);
    			append_dev(div2, t22);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*guidelines*/ 1) {
    				each_value = /*guidelines*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(table);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t11);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t14);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const guidelines = data;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ GuidelineChunk, data: data$1, guidelines });
    	return [guidelines];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
