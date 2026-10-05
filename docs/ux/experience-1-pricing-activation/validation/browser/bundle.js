const runtimeModules={"7463":(e,n)=>{function t(e,n){var t=e.length;e.push(n);e:for(;0<t;){var r=t-1>>>1,l=e[r];if(0<a(l,n))e[r]=n,e[t]=l,t=r;else break e}}function r(e){return 0===e.length?null:e[0]}function l(e){if(0===e.length)return null;var n=e[0],t=e.pop();if(t!==n){e[0]=t;e:for(var r=0,l=e.length,u=l>>>1;r<u;){var i=2*(r+1)-1,o=e[i],s=i+1,c=e[s];if(0>a(o,t))s<l&&0>a(c,o)?(e[r]=c,e[s]=t,r=s):(e[r]=o,e[i]=t,r=i);else if(s<l&&0>a(c,t))e[r]=c,e[s]=t,r=s;else break e}}return n}function a(e,n){var t=e.sortIndex-n.sortIndex;return 0!==t?t:e.id-n.id}if("object"===typeof performance&&"function"===typeof performance.now){var u=performance;n.unstable_now=function(){return u.now()}}else{var i=Date,o=i.now();n.unstable_now=function(){return i.now()-o}}var s=[],c=[],f=1,d=null,p=3,m=!1,h=!1,g=!1,v="function"===typeof setTimeout?setTimeout:null,y="function"===typeof clearTimeout?clearTimeout:null,b="undefined"!==typeof setImmediate?setImmediate:null;"undefined"!==typeof navigator&&void 0!==navigator.scheduling&&void 0!==navigator.scheduling.isInputPending&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function k(e){for(var n=r(c);null!==n;){if(null===n.callback)l(c);else if(n.startTime<=e)l(c),n.sortIndex=n.expirationTime,t(s,n);else break;n=r(c)}}function w(e){g=!1;k(e);if(!h)if(null!==r(s))h=!0,F(S);else{var n=r(c);null!==n&&D(w,n.startTime-e)}}function S(e,t){h=!1;g&&(g=!1,y(C),C=-1);m=!0;var a=p;try{k(t);for(d=r(s);null!==d&&(!(d.expirationTime>t)||e&&!z());){var u=d.callback;if("function"===typeof u){d.callback=null;p=d.priorityLevel;var i=u(d.expirationTime<=t);t=n.unstable_now();"function"===typeof i?d.callback=i:d===r(s)&&l(s);k(t)}else l(s);d=r(s)}if(null!==d)var o=!0;else{var f=r(c);null!==f&&D(w,f.startTime-t);o=!1}return o}finally{d=null,p=a,m=!1}}var x=!1,E=null,C=-1,_=5,N=-1;function z(){return n.unstable_now()-N<_?!1:!0}function P(){if(null!==E){var e=n.unstable_now();N=e;var t=!0;try{t=E(!0,e)}finally{t?T():(x=!1,E=null)}}else x=!1}var T;if("function"===typeof b)T=function(){b(P)};else if("undefined"!==typeof MessageChannel){var L=new MessageChannel,M=L.port2;L.port1.onmessage=P;T=function(){M.postMessage(null)}}else T=function(){v(P,0)};function F(e){E=e;x||(x=!0,T())}function D(e,t){C=v((function(){e(n.unstable_now())}),t)}n.unstable_IdlePriority=5;n.unstable_ImmediatePriority=1;n.unstable_LowPriority=4;n.unstable_NormalPriority=3;n.unstable_Profiling=null;n.unstable_UserBlockingPriority=2;n.unstable_cancelCallback=function(e){e.callback=null};n.unstable_continueExecution=function(){h||m||(h=!0,F(S))};n.unstable_forceFrameRate=function(e){0>e||125<e?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):_=0<e?Math.floor(1e3/e):5};n.unstable_getCurrentPriorityLevel=function(){return p};n.unstable_getFirstCallbackNode=function(){return r(s)};n.unstable_next=function(e){switch(p){case 1:case 2:case 3:var n=3;break;default:n=p}var t=p;p=n;try{return e()}finally{p=t}};n.unstable_pauseExecution=function(){};n.unstable_requestPaint=function(){};n.unstable_runWithPriority=function(e,n){switch(e){case 1:case 2:case 3:case 4:case 5:break;default:e=3}var t=p;p=e;try{return n()}finally{p=t}};n.unstable_scheduleCallback=function(e,l,a){var u=n.unstable_now();"object"===typeof a&&null!==a?(a=a.delay,a="number"===typeof a&&0<a?u+a:u):a=u;switch(e){case 1:var i=-1;break;case 2:i=250;break;case 5:i=1073741823;break;case 4:i=1e4;break;default:i=5e3}i=a+i;e={id:f++,callback:l,priorityLevel:e,startTime:a,expirationTime:i,sortIndex:-1};a>u?(e.sortIndex=a,t(c,e),null===r(s)&&e===r(c)&&(g?(y(C),C=-1):g=!0,D(w,a-u))):(e.sortIndex=i,t(s,e),h||m||(h=!0,F(S)));return e};n.unstable_shouldYield=z;n.unstable_wrapCallback=function(e){var n=p;return function(){var t=p;p=n;try{return e.apply(this,arguments)}finally{p=t}}}},"15287":(e,t)=>{var r=Symbol.for("react.element"),n=Symbol.for("react.portal"),o=Symbol.for("react.fragment"),u=Symbol.for("react.strict_mode"),a=Symbol.for("react.profiler"),c=Symbol.for("react.provider"),i=Symbol.for("react.context"),f=Symbol.for("react.forward_ref"),l=Symbol.for("react.suspense"),s=Symbol.for("react.memo"),p=Symbol.for("react.lazy"),y=Symbol.iterator;function d(e){if(null===e||"object"!==typeof e)return null;e=y&&e[y]||e["@@iterator"];return"function"===typeof e?e:null}var _={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},h=Object.assign,b={};function m(e,t,r){this.props=e;this.context=t;this.refs=b;this.updater=r||_}m.prototype.isReactComponent={};m.prototype.setState=function(e,t){if("object"!==typeof e&&"function"!==typeof e&&null!=e)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};m.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function v(){}v.prototype=m.prototype;function S(e,t,r){this.props=e;this.context=t;this.refs=b;this.updater=r||_}var k=S.prototype=new v;k.constructor=S;h(k,m.prototype);k.isPureReactComponent=!0;var w=Array.isArray,E=Object.prototype.hasOwnProperty,$={current:null},R={key:!0,ref:!0,__self:!0,__source:!0};function C(e,t,n){var o,u={},a=null,c=null;if(null!=t)for(o in void 0!==t.ref&&(c=t.ref),void 0!==t.key&&(a=""+t.key),t)E.call(t,o)&&!R.hasOwnProperty(o)&&(u[o]=t[o]);var i=arguments.length-2;if(1===i)u.children=n;else if(1<i){for(var f=Array(i),l=0;l<i;l++)f[l]=arguments[l+2];u.children=f}if(e&&e.defaultProps)for(o in i=e.defaultProps,i)void 0===u[o]&&(u[o]=i[o]);return{$$typeof:r,type:e,key:a,ref:c,props:u,_owner:$.current}}function j(e,t){return{$$typeof:r,type:e.type,key:t,ref:e.ref,props:e.props,_owner:e._owner}}function g(e){return"object"===typeof e&&null!==e&&e.$$typeof===r}function O(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,(function(e){return t[e]}))}var x=/\/+/g;function P(e,t){return"object"===typeof e&&null!==e&&null!=e.key?O(""+e.key):t.toString(36)}function I(e,t,o,u,a){var c=typeof e;if("undefined"===c||"boolean"===c)e=null;var i=!1;if(null===e)i=!0;else switch(c){case"string":case"number":i=!0;break;case"object":switch(e.$$typeof){case r:case n:i=!0}}if(i)return i=e,a=a(i),e=""===u?"."+P(i,0):u,w(a)?(o="",null!=e&&(o=e.replace(x,"$&/")+"/"),I(a,t,o,"",(function(e){return e}))):null!=a&&(g(a)&&(a=j(a,o+(!a.key||i&&i.key===a.key?"":(""+a.key).replace(x,"$&/")+"/")+e)),t.push(a)),1;i=0;u=""===u?".":u+":";if(w(e))for(var f=0;f<e.length;f++){c=e[f];var l=u+P(c,f);i+=I(c,t,o,l,a)}else if(l=d(e),"function"===typeof l)for(e=l.call(e),f=0;!(c=e.next()).done;)c=c.value,l=u+P(c,f++),i+=I(c,t,o,l,a);else if("object"===c)throw t=String(e),Error("Objects are not valid as a React child (found: "+("[object Object]"===t?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.");return i}function T(e,t,r){if(null==e)return e;var n=[],o=0;I(e,n,"","",(function(e){return t.call(r,e,o++)}));return n}function V(e){if(-1===e._status){var t=e._result;t=t();t.then((function(t){if(0===e._status||-1===e._status)e._status=1,e._result=t}),(function(t){if(0===e._status||-1===e._status)e._status=2,e._result=t}));-1===e._status&&(e._status=0,e._result=t)}if(1===e._status)return e._result.default;throw e._result}var A={current:null},D={transition:null},U={ReactCurrentDispatcher:A,ReactCurrentBatchConfig:D,ReactCurrentOwner:$};t.Children={map:T,forEach:function(e,t,r){T(e,(function(){t.apply(this,arguments)}),r)},count:function(e){var t=0;T(e,(function(){t++}));return t},toArray:function(e){return T(e,(function(e){return e}))||[]},only:function(e){if(!g(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};t.Component=m;t.Fragment=o;t.Profiler=a;t.PureComponent=S;t.StrictMode=u;t.Suspense=l;t.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=U;t.cloneElement=function(e,t,n){if(null===e||void 0===e)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+e+".");var o=h({},e.props),u=e.key,a=e.ref,c=e._owner;if(null!=t){void 0!==t.ref&&(a=t.ref,c=$.current);void 0!==t.key&&(u=""+t.key);if(e.type&&e.type.defaultProps)var i=e.type.defaultProps;for(f in t)E.call(t,f)&&!R.hasOwnProperty(f)&&(o[f]=void 0===t[f]&&void 0!==i?i[f]:t[f])}var f=arguments.length-2;if(1===f)o.children=n;else if(1<f){i=Array(f);for(var l=0;l<f;l++)i[l]=arguments[l+2];o.children=i}return{$$typeof:r,type:e.type,key:u,ref:a,props:o,_owner:c}};t.createContext=function(e){e={$$typeof:i,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null};e.Provider={$$typeof:c,_context:e};return e.Consumer=e};t.createElement=C;t.createFactory=function(e){var t=C.bind(null,e);t.type=e;return t};t.createRef=function(){return{current:null}};t.forwardRef=function(e){return{$$typeof:f,render:e}};t.isValidElement=g;t.lazy=function(e){return{$$typeof:p,_payload:{_status:-1,_result:e},_init:V}};t.memo=function(e,t){return{$$typeof:s,type:e,compare:void 0===t?null:t}};t.startTransition=function(e){var t=D.transition;D.transition={};try{e()}finally{D.transition=t}};t.unstable_act=function(){throw Error("act(...) is not supported in production builds of React.")};t.useCallback=function(e,t){return A.current.useCallback(e,t)};t.useContext=function(e){return A.current.useContext(e)};t.useDebugValue=function(){};t.useDeferredValue=function(e){return A.current.useDeferredValue(e)};t.useEffect=function(e,t){return A.current.useEffect(e,t)};t.useId=function(){return A.current.useId()};t.useImperativeHandle=function(e,t,r){return A.current.useImperativeHandle(e,t,r)};t.useInsertionEffect=function(e,t){return A.current.useInsertionEffect(e,t)};t.useLayoutEffect=function(e,t){return A.current.useLayoutEffect(e,t)};t.useMemo=function(e,t){return A.current.useMemo(e,t)};t.useReducer=function(e,t,r){return A.current.useReducer(e,t,r)};t.useRef=function(e){return A.current.useRef(e)};t.useState=function(e){return A.current.useState(e)};t.useSyncExternalStore=function(e,t,r){return A.current.useSyncExternalStore(e,t,r)};t.useTransition=function(){return A.current.useTransition()};t.version="18.2.0"},"22551":(e,n,t)=>{var r=t(44914),l=t(69982);function a(e){for(var n="https://reactjs.org/docs/error-decoder.html?invariant="+e,t=1;t<arguments.length;t++)n+="&args[]="+encodeURIComponent(arguments[t]);return"Minified React error #"+e+"; visit "+n+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var u=new Set,i={};function o(e,n){s(e,n);s(e+"Capture",n)}function s(e,n){i[e]=n;for(e=0;e<n.length;e++)u.add(n[e])}var c=!("undefined"===typeof window||"undefined"===typeof window.document||"undefined"===typeof window.document.createElement),f=Object.prototype.hasOwnProperty,d=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,p={},m={};function h(e){if(f.call(m,e))return!0;if(f.call(p,e))return!1;if(d.test(e))return m[e]=!0;p[e]=!0;return!1}function g(e,n,t,r){if(null!==t&&0===t.type)return!1;switch(typeof n){case"function":case"symbol":return!0;case"boolean":if(r)return!1;if(null!==t)return!t.acceptsBooleans;e=e.toLowerCase().slice(0,5);return"data-"!==e&&"aria-"!==e;default:return!1}}function v(e,n,t,r){if(null===n||"undefined"===typeof n||g(e,n,t,r))return!0;if(r)return!1;if(null!==t)switch(t.type){case 3:return!n;case 4:return!1===n;case 5:return isNaN(n);case 6:return isNaN(n)||1>n}return!1}function y(e,n,t,r,l,a,u){this.acceptsBooleans=2===n||3===n||4===n;this.attributeName=r;this.attributeNamespace=l;this.mustUseProperty=t;this.propertyName=e;this.type=n;this.sanitizeURL=a;this.removeEmptyString=u}var b={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach((function(e){b[e]=new y(e,0,!1,e,null,!1,!1)}));[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach((function(e){var n=e[0];b[n]=new y(n,1,!1,e[1],null,!1,!1)}));["contentEditable","draggable","spellCheck","value"].forEach((function(e){b[e]=new y(e,2,!1,e.toLowerCase(),null,!1,!1)}));["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach((function(e){b[e]=new y(e,2,!1,e,null,!1,!1)}));"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach((function(e){b[e]=new y(e,3,!1,e.toLowerCase(),null,!1,!1)}));["checked","multiple","muted","selected"].forEach((function(e){b[e]=new y(e,3,!0,e,null,!1,!1)}));["capture","download"].forEach((function(e){b[e]=new y(e,4,!1,e,null,!1,!1)}));["cols","rows","size","span"].forEach((function(e){b[e]=new y(e,6,!1,e,null,!1,!1)}));["rowSpan","start"].forEach((function(e){b[e]=new y(e,5,!1,e.toLowerCase(),null,!1,!1)}));var k=/[\-:]([a-z])/g;function w(e){return e[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach((function(e){var n=e.replace(k,w);b[n]=new y(n,1,!1,e,null,!1,!1)}));"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach((function(e){var n=e.replace(k,w);b[n]=new y(n,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)}));["xml:base","xml:lang","xml:space"].forEach((function(e){var n=e.replace(k,w);b[n]=new y(n,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)}));["tabIndex","crossOrigin"].forEach((function(e){b[e]=new y(e,1,!1,e.toLowerCase(),null,!1,!1)}));b.xlinkHref=new y("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach((function(e){b[e]=new y(e,1,!1,e.toLowerCase(),null,!0,!0)}));function S(e,n,t,r){var l=b.hasOwnProperty(n)?b[n]:null;if(null!==l?0!==l.type:r||!(2<n.length)||"o"!==n[0]&&"O"!==n[0]||"n"!==n[1]&&"N"!==n[1])v(n,t,l,r)&&(t=null),r||null===l?h(n)&&(null===t?e.removeAttribute(n):e.setAttribute(n,""+t)):l.mustUseProperty?e[l.propertyName]=null===t?3===l.type?!1:"":t:(n=l.attributeName,r=l.attributeNamespace,null===t?e.removeAttribute(n):(l=l.type,t=3===l||4===l&&!0===t?"":""+t,r?e.setAttributeNS(r,n,t):e.setAttribute(n,t)))}var x=r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,E=Symbol.for("react.element"),C=Symbol.for("react.portal"),_=Symbol.for("react.fragment"),N=Symbol.for("react.strict_mode"),z=Symbol.for("react.profiler"),P=Symbol.for("react.provider"),T=Symbol.for("react.context"),L=Symbol.for("react.forward_ref"),M=Symbol.for("react.suspense"),F=Symbol.for("react.suspense_list"),D=Symbol.for("react.memo"),R=Symbol.for("react.lazy");Symbol.for("react.scope");Symbol.for("react.debug_trace_mode");var O=Symbol.for("react.offscreen");Symbol.for("react.legacy_hidden");Symbol.for("react.cache");Symbol.for("react.tracing_marker");var I=Symbol.iterator;function U(e){if(null===e||"object"!==typeof e)return null;e=I&&e[I]||e["@@iterator"];return"function"===typeof e?e:null}var V=Object.assign,A;function B(e){if(void 0===A)try{throw Error()}catch(t){var n=t.stack.trim().match(/\n( *(at )?)/);A=n&&n[1]||""}return"\n"+A+e}var H=!1;function W(e,n){if(!e||H)return"";H=!0;var t=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(n)if(n=function(){throw Error()},Object.defineProperty(n.prototype,"props",{set:function(){throw Error()}}),"object"===typeof Reflect&&Reflect.construct){try{Reflect.construct(n,[])}catch(s){var r=s}Reflect.construct(e,[],n)}else{try{n.call()}catch(s){r=s}e.call(n.prototype)}else{try{throw Error()}catch(s){r=s}e()}}catch(s){if(s&&r&&"string"===typeof s.stack){for(var l=s.stack.split("\n"),a=r.stack.split("\n"),u=l.length-1,i=a.length-1;1<=u&&0<=i&&l[u]!==a[i];)i--;for(;1<=u&&0<=i;u--,i--)if(l[u]!==a[i]){if(1!==u||1!==i){do{if(u--,i--,0>i||l[u]!==a[i]){var o="\n"+l[u].replace(" at new "," at ");e.displayName&&o.includes("<anonymous>")&&(o=o.replace("<anonymous>",e.displayName));return o}}while(1<=u&&0<=i)}break}}}finally{H=!1,Error.prepareStackTrace=t}return(e=e?e.displayName||e.name:"")?B(e):""}function Q(e){switch(e.tag){case 5:return B(e.type);case 16:return B("Lazy");case 13:return B("Suspense");case 19:return B("SuspenseList");case 0:case 2:case 15:return e=W(e.type,!1),e;case 11:return e=W(e.type.render,!1),e;case 1:return e=W(e.type,!0),e;default:return""}}function j(e){if(null==e)return null;if("function"===typeof e)return e.displayName||e.name||null;if("string"===typeof e)return e;switch(e){case _:return"Fragment";case C:return"Portal";case z:return"Profiler";case N:return"StrictMode";case M:return"Suspense";case F:return"SuspenseList"}if("object"===typeof e)switch(e.$$typeof){case T:return(e.displayName||"Context")+".Consumer";case P:return(e._context.displayName||"Context")+".Provider";case L:var n=e.render;e=e.displayName;e||(e=n.displayName||n.name||"",e=""!==e?"ForwardRef("+e+")":"ForwardRef");return e;case D:return n=e.displayName||null,null!==n?n:j(e.type)||"Memo";case R:n=e._payload;e=e._init;try{return j(e(n))}catch(t){}}return null}function $(e){var n=e.type;switch(e.tag){case 24:return"Cache";case 9:return(n.displayName||"Context")+".Consumer";case 10:return(n._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return e=n.render,e=e.displayName||e.name||"",n.displayName||(""!==e?"ForwardRef("+e+")":"ForwardRef");case 7:return"Fragment";case 5:return n;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return j(n);case 8:return n===N?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if("function"===typeof n)return n.displayName||n.name||null;if("string"===typeof n)return n}return null}function K(e){switch(typeof e){case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function q(e){var n=e.type;return(e=e.nodeName)&&"input"===e.toLowerCase()&&("checkbox"===n||"radio"===n)}function Y(e){var n=q(e)?"checked":"value",t=Object.getOwnPropertyDescriptor(e.constructor.prototype,n),r=""+e[n];if(!e.hasOwnProperty(n)&&"undefined"!==typeof t&&"function"===typeof t.get&&"function"===typeof t.set){var l=t.get,a=t.set;Object.defineProperty(e,n,{configurable:!0,get:function(){return l.call(this)},set:function(e){r=""+e;a.call(this,e)}});Object.defineProperty(e,n,{enumerable:t.enumerable});return{getValue:function(){return r},setValue:function(e){r=""+e},stopTracking:function(){e._valueTracker=null;delete e[n]}}}}function X(e){e._valueTracker||(e._valueTracker=Y(e))}function G(e){if(!e)return!1;var n=e._valueTracker;if(!n)return!0;var t=n.getValue();var r="";e&&(r=q(e)?e.checked?"true":"false":e.value);e=r;return e!==t?(n.setValue(e),!0):!1}function Z(e){e=e||("undefined"!==typeof document?document:void 0);if("undefined"===typeof e)return null;try{return e.activeElement||e.body}catch(n){return e.body}}function J(e,n){var t=n.checked;return V({},n,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:null!=t?t:e._wrapperState.initialChecked})}function ee(e,n){var t=null==n.defaultValue?"":n.defaultValue,r=null!=n.checked?n.checked:n.defaultChecked;t=K(null!=n.value?n.value:t);e._wrapperState={initialChecked:r,initialValue:t,controlled:"checkbox"===n.type||"radio"===n.type?null!=n.checked:null!=n.value}}function ne(e,n){n=n.checked;null!=n&&S(e,"checked",n,!1)}function te(e,n){ne(e,n);var t=K(n.value),r=n.type;if(null!=t)if("number"===r){if(0===t&&""===e.value||e.value!=t)e.value=""+t}else e.value!==""+t&&(e.value=""+t);else if("submit"===r||"reset"===r){e.removeAttribute("value");return}n.hasOwnProperty("value")?le(e,n.type,t):n.hasOwnProperty("defaultValue")&&le(e,n.type,K(n.defaultValue));null==n.checked&&null!=n.defaultChecked&&(e.defaultChecked=!!n.defaultChecked)}function re(e,n,t){if(n.hasOwnProperty("value")||n.hasOwnProperty("defaultValue")){var r=n.type;if(!("submit"!==r&&"reset"!==r||void 0!==n.value&&null!==n.value))return;n=""+e._wrapperState.initialValue;t||n===e.value||(e.value=n);e.defaultValue=n}t=e.name;""!==t&&(e.name="");e.defaultChecked=!!e._wrapperState.initialChecked;""!==t&&(e.name=t)}function le(e,n,t){if("number"!==n||Z(e.ownerDocument)!==e)null==t?e.defaultValue=""+e._wrapperState.initialValue:e.defaultValue!==""+t&&(e.defaultValue=""+t)}var ae=Array.isArray;function ue(e,n,t,r){e=e.options;if(n){n={};for(var l=0;l<t.length;l++)n["$"+t[l]]=!0;for(t=0;t<e.length;t++)l=n.hasOwnProperty("$"+e[t].value),e[t].selected!==l&&(e[t].selected=l),l&&r&&(e[t].defaultSelected=!0)}else{t=""+K(t);n=null;for(l=0;l<e.length;l++){if(e[l].value===t){e[l].selected=!0;r&&(e[l].defaultSelected=!0);return}null!==n||e[l].disabled||(n=e[l])}null!==n&&(n.selected=!0)}}function ie(e,n){if(null!=n.dangerouslySetInnerHTML)throw Error(a(91));return V({},n,{value:void 0,defaultValue:void 0,children:""+e._wrapperState.initialValue})}function oe(e,n){var t=n.value;if(null==t){t=n.children;n=n.defaultValue;if(null!=t){if(null!=n)throw Error(a(92));if(ae(t)){if(1<t.length)throw Error(a(93));t=t[0]}n=t}null==n&&(n="");t=n}e._wrapperState={initialValue:K(t)}}function se(e,n){var t=K(n.value),r=K(n.defaultValue);null!=t&&(t=""+t,t!==e.value&&(e.value=t),null==n.defaultValue&&e.defaultValue!==t&&(e.defaultValue=t));null!=r&&(e.defaultValue=""+r)}function ce(e){var n=e.textContent;n===e._wrapperState.initialValue&&""!==n&&null!==n&&(e.value=n)}function fe(e){switch(e){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function de(e,n){return null==e||"http://www.w3.org/1999/xhtml"===e?fe(n):"http://www.w3.org/2000/svg"===e&&"foreignObject"===n?"http://www.w3.org/1999/xhtml":e}var pe,me=function(e){return"undefined"!==typeof MSApp&&MSApp.execUnsafeLocalFunction?function(n,t,r,l){MSApp.execUnsafeLocalFunction((function(){return e(n,t,r,l)}))}:e}((function(e,n){if("http://www.w3.org/2000/svg"!==e.namespaceURI||"innerHTML"in e)e.innerHTML=n;else{pe=pe||document.createElement("div");pe.innerHTML="<svg>"+n.valueOf().toString()+"</svg>";for(n=pe.firstChild;e.firstChild;)e.removeChild(e.firstChild);for(;n.firstChild;)e.appendChild(n.firstChild)}}));function he(e,n){if(n){var t=e.firstChild;if(t&&t===e.lastChild&&3===t.nodeType){t.nodeValue=n;return}}e.textContent=n}var ge={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},ve=["Webkit","ms","Moz","O"];Object.keys(ge).forEach((function(e){ve.forEach((function(n){n=n+e.charAt(0).toUpperCase()+e.substring(1);ge[n]=ge[e]}))}));function ye(e,n,t){return null==n||"boolean"===typeof n||""===n?"":t||"number"!==typeof n||0===n||ge.hasOwnProperty(e)&&ge[e]?(""+n).trim():n+"px"}function be(e,n){e=e.style;for(var t in n)if(n.hasOwnProperty(t)){var r=0===t.indexOf("--"),l=ye(t,n[t],r);"float"===t&&(t="cssFloat");r?e.setProperty(t,l):e[t]=l}}var ke=V({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function we(e,n){if(n){if(ke[e]&&(null!=n.children||null!=n.dangerouslySetInnerHTML))throw Error(a(137,e));if(null!=n.dangerouslySetInnerHTML){if(null!=n.children)throw Error(a(60));if("object"!==typeof n.dangerouslySetInnerHTML||!("__html"in n.dangerouslySetInnerHTML))throw Error(a(61))}if(null!=n.style&&"object"!==typeof n.style)throw Error(a(62))}}function Se(e,n){if(-1===e.indexOf("-"))return"string"===typeof n.is;switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var xe=null;function Ee(e){e=e.target||e.srcElement||window;e.correspondingUseElement&&(e=e.correspondingUseElement);return 3===e.nodeType?e.parentNode:e}var Ce=null,_e=null,Ne=null;function ze(e){if(e=Bl(e)){if("function"!==typeof Ce)throw Error(a(280));var n=e.stateNode;n&&(n=Wl(n),Ce(e.stateNode,e.type,n))}}function Pe(e){_e?Ne?Ne.push(e):Ne=[e]:_e=e}function Te(){if(_e){var e=_e,n=Ne;Ne=_e=null;ze(e);if(n)for(e=0;e<n.length;e++)ze(n[e])}}function Le(e,n){return e(n)}function Me(){}var Fe=!1;function De(e,n,t){if(Fe)return e(n,t);Fe=!0;try{return Le(e,n,t)}finally{if(Fe=!1,null!==_e||null!==Ne)Me(),Te()}}function Re(e,n){var t=e.stateNode;if(null===t)return null;var r=Wl(t);if(null===r)return null;t=r[n];e:switch(n){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(r=!r.disabled)||(e=e.type,r=!("button"===e||"input"===e||"select"===e||"textarea"===e));e=!r;break e;default:e=!1}if(e)return null;if(t&&"function"!==typeof t)throw Error(a(231,n,typeof t));return t}var Oe=!1;if(c)try{var Ie={};Object.defineProperty(Ie,"passive",{get:function(){Oe=!0}});window.addEventListener("test",Ie,Ie);window.removeEventListener("test",Ie,Ie)}catch(Ic){Oe=!1}function Ue(e,n,t,r,l,a,u,i,o){var s=Array.prototype.slice.call(arguments,3);try{n.apply(t,s)}catch(c){this.onError(c)}}var Ve=!1,Ae=null,Be=!1,He=null,We={onError:function(e){Ve=!0;Ae=e}};function Qe(e,n,t,r,l,a,u,i,o){Ve=!1;Ae=null;Ue.apply(We,arguments)}function je(e,n,t,r,l,u,i,o,s){Qe.apply(this,arguments);if(Ve){if(Ve){var c=Ae;Ve=!1;Ae=null}else throw Error(a(198));Be||(Be=!0,He=c)}}function $e(e){var n=e,t=e;if(e.alternate)for(;n.return;)n=n.return;else{e=n;do{n=e,0!==(n.flags&4098)&&(t=n.return),e=n.return}while(e)}return 3===n.tag?t:null}function Ke(e){if(13===e.tag){var n=e.memoizedState;null===n&&(e=e.alternate,null!==e&&(n=e.memoizedState));if(null!==n)return n.dehydrated}return null}function qe(e){if($e(e)!==e)throw Error(a(188))}function Ye(e){var n=e.alternate;if(!n){n=$e(e);if(null===n)throw Error(a(188));return n!==e?null:e}for(var t=e,r=n;;){var l=t.return;if(null===l)break;var u=l.alternate;if(null===u){r=l.return;if(null!==r){t=r;continue}break}if(l.child===u.child){for(u=l.child;u;){if(u===t)return qe(l),e;if(u===r)return qe(l),n;u=u.sibling}throw Error(a(188))}if(t.return!==r.return)t=l,r=u;else{for(var i=!1,o=l.child;o;){if(o===t){i=!0;t=l;r=u;break}if(o===r){i=!0;r=l;t=u;break}o=o.sibling}if(!i){for(o=u.child;o;){if(o===t){i=!0;t=u;r=l;break}if(o===r){i=!0;r=u;t=l;break}o=o.sibling}if(!i)throw Error(a(189))}}if(t.alternate!==r)throw Error(a(190))}if(3!==t.tag)throw Error(a(188));return t.stateNode.current===t?e:n}function Xe(e){e=Ye(e);return null!==e?Ge(e):null}function Ge(e){if(5===e.tag||6===e.tag)return e;for(e=e.child;null!==e;){var n=Ge(e);if(null!==n)return n;e=e.sibling}return null}var Ze=l.unstable_scheduleCallback,Je=l.unstable_cancelCallback,en=l.unstable_shouldYield,nn=l.unstable_requestPaint,tn=l.unstable_now,rn=l.unstable_getCurrentPriorityLevel,ln=l.unstable_ImmediatePriority,an=l.unstable_UserBlockingPriority,un=l.unstable_NormalPriority,on=l.unstable_LowPriority,sn=l.unstable_IdlePriority,cn=null,fn=null;function dn(e){if(fn&&"function"===typeof fn.onCommitFiberRoot)try{fn.onCommitFiberRoot(cn,e,void 0,128===(e.current.flags&128))}catch(n){}}var pn=Math.clz32?Math.clz32:gn,mn=Math.log,hn=Math.LN2;function gn(e){e>>>=0;return 0===e?32:31-(mn(e)/hn|0)|0}var vn=64,yn=4194304;function bn(e){switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return e&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return e}}function kn(e,n){var t=e.pendingLanes;if(0===t)return 0;var r=0,l=e.suspendedLanes,a=e.pingedLanes,u=t&268435455;if(0!==u){var i=u&~l;0!==i?r=bn(i):(a&=u,0!==a&&(r=bn(a)))}else u=t&~l,0!==u?r=bn(u):0!==a&&(r=bn(a));if(0===r)return 0;if(0!==n&&n!==r&&0===(n&l)&&(l=r&-r,a=n&-n,l>=a||16===l&&0!==(a&4194240)))return n;0!==(r&4)&&(r|=t&16);n=e.entangledLanes;if(0!==n)for(e=e.entanglements,n&=r;0<n;)t=31-pn(n),l=1<<t,r|=e[t],n&=~l;return r}function wn(e,n){switch(e){case 1:case 2:case 4:return n+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return n+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Sn(e,n){for(var t=e.suspendedLanes,r=e.pingedLanes,l=e.expirationTimes,a=e.pendingLanes;0<a;){var u=31-pn(a),i=1<<u,o=l[u];if(-1===o){if(0===(i&t)||0!==(i&r))l[u]=wn(i,n)}else o<=n&&(e.expiredLanes|=i);a&=~i}}function xn(e){e=e.pendingLanes&-1073741825;return 0!==e?e:e&1073741824?1073741824:0}function En(){var e=vn;vn<<=1;0===(vn&4194240)&&(vn=64);return e}function Cn(e){for(var n=[],t=0;31>t;t++)n.push(e);return n}function _n(e,n,t){e.pendingLanes|=n;536870912!==n&&(e.suspendedLanes=0,e.pingedLanes=0);e=e.eventTimes;n=31-pn(n);e[n]=t}function Nn(e,n){var t=e.pendingLanes&~n;e.pendingLanes=n;e.suspendedLanes=0;e.pingedLanes=0;e.expiredLanes&=n;e.mutableReadLanes&=n;e.entangledLanes&=n;n=e.entanglements;var r=e.eventTimes;for(e=e.expirationTimes;0<t;){var l=31-pn(t),a=1<<l;n[l]=0;r[l]=-1;e[l]=-1;t&=~a}}function zn(e,n){var t=e.entangledLanes|=n;for(e=e.entanglements;t;){var r=31-pn(t),l=1<<r;l&n|e[r]&n&&(e[r]|=n);t&=~l}}var Pn=0;function Tn(e){e&=-e;return 1<e?4<e?0!==(e&268435455)?16:536870912:4:1}var Ln,Mn,Fn,Dn,Rn,On=!1,In=[],Un=null,Vn=null,An=null,Bn=new Map,Hn=new Map,Wn=[],Qn="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function jn(e,n){switch(e){case"focusin":case"focusout":Un=null;break;case"dragenter":case"dragleave":Vn=null;break;case"mouseover":case"mouseout":An=null;break;case"pointerover":case"pointerout":Bn.delete(n.pointerId);break;case"gotpointercapture":case"lostpointercapture":Hn.delete(n.pointerId)}}function $n(e,n,t,r,l,a){if(null===e||e.nativeEvent!==a)return e={blockedOn:n,domEventName:t,eventSystemFlags:r,nativeEvent:a,targetContainers:[l]},null!==n&&(n=Bl(n),null!==n&&Mn(n)),e;e.eventSystemFlags|=r;n=e.targetContainers;null!==l&&-1===n.indexOf(l)&&n.push(l);return e}function Kn(e,n,t,r,l){switch(n){case"focusin":return Un=$n(Un,e,n,t,r,l),!0;case"dragenter":return Vn=$n(Vn,e,n,t,r,l),!0;case"mouseover":return An=$n(An,e,n,t,r,l),!0;case"pointerover":var a=l.pointerId;Bn.set(a,$n(Bn.get(a)||null,e,n,t,r,l));return!0;case"gotpointercapture":return a=l.pointerId,Hn.set(a,$n(Hn.get(a)||null,e,n,t,r,l)),!0}return!1}function qn(e){var n=Al(e.target);if(null!==n){var t=$e(n);if(null!==t)if(n=t.tag,13===n){if(n=Ke(t),null!==n){e.blockedOn=n;Rn(e.priority,(function(){Fn(t)}));return}}else if(3===n&&t.stateNode.current.memoizedState.isDehydrated){e.blockedOn=3===t.tag?t.stateNode.containerInfo:null;return}}e.blockedOn=null}function Yn(e){if(null!==e.blockedOn)return!1;for(var n=e.targetContainers;0<n.length;){var t=ut(e.domEventName,e.eventSystemFlags,n[0],e.nativeEvent);if(null===t){t=e.nativeEvent;var r=new t.constructor(t.type,t);xe=r;t.target.dispatchEvent(r);xe=null}else return n=Bl(t),null!==n&&Mn(n),e.blockedOn=t,!1;n.shift()}return!0}function Xn(e,n,t){Yn(e)&&t.delete(n)}function Gn(){On=!1;null!==Un&&Yn(Un)&&(Un=null);null!==Vn&&Yn(Vn)&&(Vn=null);null!==An&&Yn(An)&&(An=null);Bn.forEach(Xn);Hn.forEach(Xn)}function Zn(e,n){e.blockedOn===n&&(e.blockedOn=null,On||(On=!0,l.unstable_scheduleCallback(l.unstable_NormalPriority,Gn)))}function Jn(e){function n(n){return Zn(n,e)}if(0<In.length){Zn(In[0],e);for(var t=1;t<In.length;t++){var r=In[t];r.blockedOn===e&&(r.blockedOn=null)}}null!==Un&&Zn(Un,e);null!==Vn&&Zn(Vn,e);null!==An&&Zn(An,e);Bn.forEach(n);Hn.forEach(n);for(t=0;t<Wn.length;t++)r=Wn[t],r.blockedOn===e&&(r.blockedOn=null);for(;0<Wn.length&&(t=Wn[0],null===t.blockedOn);)qn(t),null===t.blockedOn&&Wn.shift()}var et=x.ReactCurrentBatchConfig,nt=!0;function tt(e,n,t,r){var l=Pn,a=et.transition;et.transition=null;try{Pn=1,lt(e,n,t,r)}finally{Pn=l,et.transition=a}}function rt(e,n,t,r){var l=Pn,a=et.transition;et.transition=null;try{Pn=4,lt(e,n,t,r)}finally{Pn=l,et.transition=a}}function lt(e,n,t,r){if(nt){var l=ut(e,n,t,r);if(null===l)dl(e,n,r,at,t),jn(e,r);else if(Kn(l,e,n,t,r))r.stopPropagation();else if(jn(e,r),n&4&&-1<Qn.indexOf(e)){for(;null!==l;){var a=Bl(l);null!==a&&Ln(a);a=ut(e,n,t,r);null===a&&dl(e,n,r,at,t);if(a===l)break;l=a}null!==l&&r.stopPropagation()}else dl(e,n,r,null,t)}}var at=null;function ut(e,n,t,r){at=null;e=Ee(r);e=Al(e);if(null!==e)if(n=$e(e),null===n)e=null;else if(t=n.tag,13===t){e=Ke(n);if(null!==e)return e;e=null}else if(3===t){if(n.stateNode.current.memoizedState.isDehydrated)return 3===n.tag?n.stateNode.containerInfo:null;e=null}else n!==e&&(e=null);at=e;return null}function it(e){switch(e){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(rn()){case ln:return 1;case an:return 4;case un:case on:return 16;case sn:return 536870912;default:return 16}default:return 16}}var ot=null,st=null,ct=null;function ft(){if(ct)return ct;var e,n=st,t=n.length,r,l="value"in ot?ot.value:ot.textContent,a=l.length;for(e=0;e<t&&n[e]===l[e];e++);var u=t-e;for(r=1;r<=u&&n[t-r]===l[a-r];r++);return ct=l.slice(e,1<r?1-r:void 0)}function dt(e){var n=e.keyCode;"charCode"in e?(e=e.charCode,0===e&&13===n&&(e=13)):e=n;10===e&&(e=13);return 32<=e||13===e?e:0}function pt(){return!0}function mt(){return!1}function ht(e){function n(n,t,r,l,a){this._reactName=n;this._targetInst=r;this.type=t;this.nativeEvent=l;this.target=a;this.currentTarget=null;for(var u in e)e.hasOwnProperty(u)&&(n=e[u],this[u]=n?n(l):l[u]);this.isDefaultPrevented=(null!=l.defaultPrevented?l.defaultPrevented:!1===l.returnValue)?pt:mt;this.isPropagationStopped=mt;return this}V(n.prototype,{preventDefault:function(){this.defaultPrevented=!0;var e=this.nativeEvent;e&&(e.preventDefault?e.preventDefault():"unknown"!==typeof e.returnValue&&(e.returnValue=!1),this.isDefaultPrevented=pt)},stopPropagation:function(){var e=this.nativeEvent;e&&(e.stopPropagation?e.stopPropagation():"unknown"!==typeof e.cancelBubble&&(e.cancelBubble=!0),this.isPropagationStopped=pt)},persist:function(){},isPersistent:pt});return n}var gt={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},vt=ht(gt),yt=V({},gt,{view:0,detail:0}),bt=ht(yt),kt,wt,St,xt=V({},yt,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Vt,button:0,buttons:0,relatedTarget:function(e){return void 0===e.relatedTarget?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){if("movementX"in e)return e.movementX;e!==St&&(St&&"mousemove"===e.type?(kt=e.screenX-St.screenX,wt=e.screenY-St.screenY):wt=kt=0,St=e);return kt},movementY:function(e){return"movementY"in e?e.movementY:wt}}),Et=ht(xt),Ct=V({},xt,{dataTransfer:0}),_t=ht(Ct),Nt=V({},yt,{relatedTarget:0}),zt=ht(Nt),Pt=V({},gt,{animationName:0,elapsedTime:0,pseudoElement:0}),Tt=ht(Pt),Lt=V({},gt,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),Mt=ht(Lt),Ft=V({},gt,{data:0}),Dt=ht(Ft),Rt={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},Ot={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},It={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function Ut(e){var n=this.nativeEvent;return n.getModifierState?n.getModifierState(e):(e=It[e])?!!n[e]:!1}function Vt(){return Ut}var At=V({},yt,{key:function(e){if(e.key){var n=Rt[e.key]||e.key;if("Unidentified"!==n)return n}return"keypress"===e.type?(e=dt(e),13===e?"Enter":String.fromCharCode(e)):"keydown"===e.type||"keyup"===e.type?Ot[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Vt,charCode:function(e){return"keypress"===e.type?dt(e):0},keyCode:function(e){return"keydown"===e.type||"keyup"===e.type?e.keyCode:0},which:function(e){return"keypress"===e.type?dt(e):"keydown"===e.type||"keyup"===e.type?e.keyCode:0}}),Bt=ht(At),Ht=V({},xt,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),Wt=ht(Ht),Qt=V({},yt,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Vt}),jt=ht(Qt),$t=V({},gt,{propertyName:0,elapsedTime:0,pseudoElement:0}),Kt=ht($t),qt=V({},xt,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),Yt=ht(qt),Xt=[9,13,27,32],Gt=c&&"CompositionEvent"in window,Zt=null;c&&"documentMode"in document&&(Zt=document.documentMode);var Jt=c&&"TextEvent"in window&&!Zt,er=c&&(!Gt||Zt&&8<Zt&&11>=Zt),nr=String.fromCharCode(32),tr=!1;function rr(e,n){switch(e){case"keyup":return-1!==Xt.indexOf(n.keyCode);case"keydown":return 229!==n.keyCode;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function lr(e){e=e.detail;return"object"===typeof e&&"data"in e?e.data:null}var ar=!1;function ur(e,n){switch(e){case"compositionend":return lr(n);case"keypress":if(32!==n.which)return null;tr=!0;return nr;case"textInput":return e=n.data,e===nr&&tr?null:e;default:return null}}function ir(e,n){if(ar)return"compositionend"===e||!Gt&&rr(e,n)?(e=ft(),ct=st=ot=null,ar=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(n.ctrlKey||n.altKey||n.metaKey)||n.ctrlKey&&n.altKey){if(n.char&&1<n.char.length)return n.char;if(n.which)return String.fromCharCode(n.which)}return null;case"compositionend":return er&&"ko"!==n.locale?null:n.data;default:return null}}var or={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function sr(e){var n=e&&e.nodeName&&e.nodeName.toLowerCase();return"input"===n?!!or[e.type]:"textarea"===n?!0:!1}function cr(e,n,t,r){Pe(r);n=ml(n,"onChange");0<n.length&&(t=new vt("onChange","change",null,t,r),e.push({event:t,listeners:n}))}var fr=null,dr=null;function pr(e){ul(e,0)}function mr(e){var n=Hl(e);if(G(n))return e}function hr(e,n){if("change"===e)return n}var gr=!1;if(c){var vr;if(c){var yr="oninput"in document;if(!yr){var br=document.createElement("div");br.setAttribute("oninput","return;");yr="function"===typeof br.oninput}vr=yr}else vr=!1;gr=vr&&(!document.documentMode||9<document.documentMode)}function kr(){fr&&(fr.detachEvent("onpropertychange",wr),dr=fr=null)}function wr(e){if("value"===e.propertyName&&mr(dr)){var n=[];cr(n,dr,e,Ee(e));De(pr,n)}}function Sr(e,n,t){"focusin"===e?(kr(),fr=n,dr=t,fr.attachEvent("onpropertychange",wr)):"focusout"===e&&kr()}function xr(e){if("selectionchange"===e||"keyup"===e||"keydown"===e)return mr(dr)}function Er(e,n){if("click"===e)return mr(n)}function Cr(e,n){if("input"===e||"change"===e)return mr(n)}function _r(e,n){return e===n&&(0!==e||1/e===1/n)||e!==e&&n!==n}var Nr="function"===typeof Object.is?Object.is:_r;function zr(e,n){if(Nr(e,n))return!0;if("object"!==typeof e||null===e||"object"!==typeof n||null===n)return!1;var t=Object.keys(e),r=Object.keys(n);if(t.length!==r.length)return!1;for(r=0;r<t.length;r++){var l=t[r];if(!f.call(n,l)||!Nr(e[l],n[l]))return!1}return!0}function Pr(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function Tr(e,n){var t=Pr(e);e=0;for(var r;t;){if(3===t.nodeType){r=e+t.textContent.length;if(e<=n&&r>=n)return{node:t,offset:n-e};e=r}e:{for(;t;){if(t.nextSibling){t=t.nextSibling;break e}t=t.parentNode}t=void 0}t=Pr(t)}}function Lr(e,n){return e&&n?e===n?!0:e&&3===e.nodeType?!1:n&&3===n.nodeType?Lr(e,n.parentNode):"contains"in e?e.contains(n):e.compareDocumentPosition?!!(e.compareDocumentPosition(n)&16):!1:!1}function Mr(){for(var e=window,n=Z();n instanceof e.HTMLIFrameElement;){try{var t="string"===typeof n.contentWindow.location.href}catch(r){t=!1}if(t)e=n.contentWindow;else break;n=Z(e.document)}return n}function Fr(e){var n=e&&e.nodeName&&e.nodeName.toLowerCase();return n&&("input"===n&&("text"===e.type||"search"===e.type||"tel"===e.type||"url"===e.type||"password"===e.type)||"textarea"===n||"true"===e.contentEditable)}function Dr(e){var n=Mr(),t=e.focusedElem,r=e.selectionRange;if(n!==t&&t&&t.ownerDocument&&Lr(t.ownerDocument.documentElement,t)){if(null!==r&&Fr(t))if(n=r.start,e=r.end,void 0===e&&(e=n),"selectionStart"in t)t.selectionStart=n,t.selectionEnd=Math.min(e,t.value.length);else if(e=(n=t.ownerDocument||document)&&n.defaultView||window,e.getSelection){e=e.getSelection();var l=t.textContent.length,a=Math.min(r.start,l);r=void 0===r.end?a:Math.min(r.end,l);!e.extend&&a>r&&(l=r,r=a,a=l);l=Tr(t,a);var u=Tr(t,r);l&&u&&(1!==e.rangeCount||e.anchorNode!==l.node||e.anchorOffset!==l.offset||e.focusNode!==u.node||e.focusOffset!==u.offset)&&(n=n.createRange(),n.setStart(l.node,l.offset),e.removeAllRanges(),a>r?(e.addRange(n),e.extend(u.node,u.offset)):(n.setEnd(u.node,u.offset),e.addRange(n)))}n=[];for(e=t;e=e.parentNode;)1===e.nodeType&&n.push({element:e,left:e.scrollLeft,top:e.scrollTop});"function"===typeof t.focus&&t.focus();for(t=0;t<n.length;t++)e=n[t],e.element.scrollLeft=e.left,e.element.scrollTop=e.top}}var Rr=c&&"documentMode"in document&&11>=document.documentMode,Or=null,Ir=null,Ur=null,Vr=!1;function Ar(e,n,t){var r=t.window===t?t.document:9===t.nodeType?t:t.ownerDocument;Vr||null==Or||Or!==Z(r)||(r=Or,"selectionStart"in r&&Fr(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),Ur&&zr(Ur,r)||(Ur=r,r=ml(Ir,"onSelect"),0<r.length&&(n=new vt("onSelect","select",null,n,t),e.push({event:n,listeners:r}),n.target=Or)))}function Br(e,n){var t={};t[e.toLowerCase()]=n.toLowerCase();t["Webkit"+e]="webkit"+n;t["Moz"+e]="moz"+n;return t}var Hr={animationend:Br("Animation","AnimationEnd"),animationiteration:Br("Animation","AnimationIteration"),animationstart:Br("Animation","AnimationStart"),transitionend:Br("Transition","TransitionEnd")},Wr={},Qr={};c&&(Qr=document.createElement("div").style,"AnimationEvent"in window||(delete Hr.animationend.animation,delete Hr.animationiteration.animation,delete Hr.animationstart.animation),"TransitionEvent"in window||delete Hr.transitionend.transition);function jr(e){if(Wr[e])return Wr[e];if(!Hr[e])return e;var n=Hr[e],t;for(t in n)if(n.hasOwnProperty(t)&&t in Qr)return Wr[e]=n[t];return e}var $r=jr("animationend"),Kr=jr("animationiteration"),qr=jr("animationstart"),Yr=jr("transitionend"),Xr=new Map,Gr="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function Zr(e,n){Xr.set(e,n);o(n,[e])}for(var Jr=0;Jr<Gr.length;Jr++){var el=Gr[Jr],nl=el.toLowerCase(),tl=el[0].toUpperCase()+el.slice(1);Zr(nl,"on"+tl)}Zr($r,"onAnimationEnd");Zr(Kr,"onAnimationIteration");Zr(qr,"onAnimationStart");Zr("dblclick","onDoubleClick");Zr("focusin","onFocus");Zr("focusout","onBlur");Zr(Yr,"onTransitionEnd");s("onMouseEnter",["mouseout","mouseover"]);s("onMouseLeave",["mouseout","mouseover"]);s("onPointerEnter",["pointerout","pointerover"]);s("onPointerLeave",["pointerout","pointerover"]);o("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));o("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));o("onBeforeInput",["compositionend","keypress","textInput","paste"]);o("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));o("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));o("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var rl="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),ll=new Set("cancel close invalid load scroll toggle".split(" ").concat(rl));function al(e,n,t){var r=e.type||"unknown-event";e.currentTarget=t;je(r,n,void 0,e);e.currentTarget=null}function ul(e,n){n=0!==(n&4);for(var t=0;t<e.length;t++){var r=e[t],l=r.event;r=r.listeners;e:{var a=void 0;if(n)for(var u=r.length-1;0<=u;u--){var i=r[u],o=i.instance,s=i.currentTarget;i=i.listener;if(o!==a&&l.isPropagationStopped())break e;al(l,i,s);a=o}else for(u=0;u<r.length;u++){i=r[u];o=i.instance;s=i.currentTarget;i=i.listener;if(o!==a&&l.isPropagationStopped())break e;al(l,i,s);a=o}}}if(Be)throw e=He,Be=!1,He=null,e}function il(e,n){var t=n[Il];void 0===t&&(t=n[Il]=new Set);var r=e+"__bubble";t.has(r)||(fl(n,e,2,!1),t.add(r))}function ol(e,n,t){var r=0;n&&(r|=4);fl(t,e,r,n)}var sl="_reactListening"+Math.random().toString(36).slice(2);function cl(e){if(!e[sl]){e[sl]=!0;u.forEach((function(n){"selectionchange"!==n&&(ll.has(n)||ol(n,!1,e),ol(n,!0,e))}));var n=9===e.nodeType?e:e.ownerDocument;null===n||n[sl]||(n[sl]=!0,ol("selectionchange",!1,n))}}function fl(e,n,t,r){switch(it(n)){case 1:var l=tt;break;case 4:l=rt;break;default:l=lt}t=l.bind(null,n,t,e);l=void 0;!Oe||"touchstart"!==n&&"touchmove"!==n&&"wheel"!==n||(l=!0);r?void 0!==l?e.addEventListener(n,t,{capture:!0,passive:l}):e.addEventListener(n,t,!0):void 0!==l?e.addEventListener(n,t,{passive:l}):e.addEventListener(n,t,!1)}function dl(e,n,t,r,l){var a=r;if(0===(n&1)&&0===(n&2)&&null!==r)e:for(;;){if(null===r)return;var u=r.tag;if(3===u||4===u){var i=r.stateNode.containerInfo;if(i===l||8===i.nodeType&&i.parentNode===l)break;if(4===u)for(u=r.return;null!==u;){var o=u.tag;if(3===o||4===o)if(o=u.stateNode.containerInfo,o===l||8===o.nodeType&&o.parentNode===l)return;u=u.return}for(;null!==i;){u=Al(i);if(null===u)return;o=u.tag;if(5===o||6===o){r=a=u;continue e}i=i.parentNode}}r=r.return}De((function(){var r=a,l=Ee(t),u=[];e:{var i=Xr.get(e);if(void 0!==i){var o=vt,s=e;switch(e){case"keypress":if(0===dt(t))break e;case"keydown":case"keyup":o=Bt;break;case"focusin":s="focus";o=zt;break;case"focusout":s="blur";o=zt;break;case"beforeblur":case"afterblur":o=zt;break;case"click":if(2===t.button)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":o=Et;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":o=_t;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":o=jt;break;case $r:case Kr:case qr:o=Tt;break;case Yr:o=Kt;break;case"scroll":o=bt;break;case"wheel":o=Yt;break;case"copy":case"cut":case"paste":o=Mt;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":o=Wt}var c=0!==(n&4),f=!c&&"scroll"===e,d=c?null!==i?i+"Capture":null:i;c=[];for(var p=r,m;null!==p;){m=p;var h=m.stateNode;5===m.tag&&null!==h&&(m=h,null!==d&&(h=Re(p,d),null!=h&&c.push(pl(p,h,m))));if(f)break;p=p.return}0<c.length&&(i=new o(i,s,null,t,l),u.push({event:i,listeners:c}))}}if(0===(n&7)){e:{i="mouseover"===e||"pointerover"===e;o="mouseout"===e||"pointerout"===e;if(i&&t!==xe&&(s=t.relatedTarget||t.fromElement)&&(Al(s)||s[Ol]))break e;if(o||i){i=l.window===l?l:(i=l.ownerDocument)?i.defaultView||i.parentWindow:window;if(o){if(s=t.relatedTarget||t.toElement,o=r,s=s?Al(s):null,null!==s&&(f=$e(s),s!==f||5!==s.tag&&6!==s.tag))s=null}else o=null,s=r;if(o!==s){c=Et;h="onMouseLeave";d="onMouseEnter";p="mouse";if("pointerout"===e||"pointerover"===e)c=Wt,h="onPointerLeave",d="onPointerEnter",p="pointer";f=null==o?i:Hl(o);m=null==s?i:Hl(s);i=new c(h,p+"leave",o,t,l);i.target=f;i.relatedTarget=m;h=null;Al(l)===r&&(c=new c(d,p+"enter",s,t,l),c.target=m,c.relatedTarget=f,h=c);f=h;if(o&&s)n:{c=o;d=s;p=0;for(m=c;m;m=hl(m))p++;m=0;for(h=d;h;h=hl(h))m++;for(;0<p-m;)c=hl(c),p--;for(;0<m-p;)d=hl(d),m--;for(;p--;){if(c===d||null!==d&&c===d.alternate)break n;c=hl(c);d=hl(d)}c=null}else c=null;null!==o&&gl(u,i,o,c,!1);null!==s&&null!==f&&gl(u,f,s,c,!0)}}}e:{i=r?Hl(r):window;o=i.nodeName&&i.nodeName.toLowerCase();if("select"===o||"input"===o&&"file"===i.type)var g=hr;else if(sr(i))if(gr)g=Cr;else{g=xr;var v=Sr}else(o=i.nodeName)&&"input"===o.toLowerCase()&&("checkbox"===i.type||"radio"===i.type)&&(g=Er);if(g&&(g=g(e,r))){cr(u,g,t,l);break e}v&&v(e,i,r);"focusout"===e&&(v=i._wrapperState)&&v.controlled&&"number"===i.type&&le(i,"number",i.value)}v=r?Hl(r):window;switch(e){case"focusin":if(sr(v)||"true"===v.contentEditable)Or=v,Ir=r,Ur=null;break;case"focusout":Ur=Ir=Or=null;break;case"mousedown":Vr=!0;break;case"contextmenu":case"mouseup":case"dragend":Vr=!1;Ar(u,t,l);break;case"selectionchange":if(Rr)break;case"keydown":case"keyup":Ar(u,t,l)}var y;if(Gt)e:{switch(e){case"compositionstart":var b="onCompositionStart";break e;case"compositionend":b="onCompositionEnd";break e;case"compositionupdate":b="onCompositionUpdate";break e}b=void 0}else ar?rr(e,t)&&(b="onCompositionEnd"):"keydown"===e&&229===t.keyCode&&(b="onCompositionStart");b&&(er&&"ko"!==t.locale&&(ar||"onCompositionStart"!==b?"onCompositionEnd"===b&&ar&&(y=ft()):(ot=l,st="value"in ot?ot.value:ot.textContent,ar=!0)),v=ml(r,b),0<v.length&&(b=new Dt(b,e,null,t,l),u.push({event:b,listeners:v}),y?b.data=y:(y=lr(t),null!==y&&(b.data=y))));if(y=Jt?ur(e,t):ir(e,t))r=ml(r,"onBeforeInput"),0<r.length&&(l=new Dt("onBeforeInput","beforeinput",null,t,l),u.push({event:l,listeners:r}),l.data=y)}ul(u,n)}))}function pl(e,n,t){return{instance:e,listener:n,currentTarget:t}}function ml(e,n){for(var t=n+"Capture",r=[];null!==e;){var l=e,a=l.stateNode;5===l.tag&&null!==a&&(l=a,a=Re(e,t),null!=a&&r.unshift(pl(e,a,l)),a=Re(e,n),null!=a&&r.push(pl(e,a,l)));e=e.return}return r}function hl(e){if(null===e)return null;do{e=e.return}while(e&&5!==e.tag);return e?e:null}function gl(e,n,t,r,l){for(var a=n._reactName,u=[];null!==t&&t!==r;){var i=t,o=i.alternate,s=i.stateNode;if(null!==o&&o===r)break;5===i.tag&&null!==s&&(i=s,l?(o=Re(t,a),null!=o&&u.unshift(pl(t,o,i))):l||(o=Re(t,a),null!=o&&u.push(pl(t,o,i))));t=t.return}0!==u.length&&e.push({event:n,listeners:u})}var vl=/\r\n?/g,yl=/\u0000|\uFFFD/g;function bl(e){return("string"===typeof e?e:""+e).replace(vl,"\n").replace(yl,"")}function kl(e,n,t){n=bl(n);if(bl(e)!==n&&t)throw Error(a(425))}function wl(){}var Sl=null,xl=null;function El(e,n){return"textarea"===e||"noscript"===e||"string"===typeof n.children||"number"===typeof n.children||"object"===typeof n.dangerouslySetInnerHTML&&null!==n.dangerouslySetInnerHTML&&null!=n.dangerouslySetInnerHTML.__html}var Cl="function"===typeof setTimeout?setTimeout:void 0,_l="function"===typeof clearTimeout?clearTimeout:void 0,Nl="function"===typeof Promise?Promise:void 0,zl="function"===typeof queueMicrotask?queueMicrotask:"undefined"!==typeof Nl?function(e){return Nl.resolve(null).then(e).catch(Pl)}:Cl;function Pl(e){setTimeout((function(){throw e}))}function Tl(e,n){var t=n,r=0;do{var l=t.nextSibling;e.removeChild(t);if(l&&8===l.nodeType)if(t=l.data,"/$"===t){if(0===r){e.removeChild(l);Jn(n);return}r--}else"$"!==t&&"$?"!==t&&"$!"!==t||r++;t=l}while(t);Jn(n)}function Ll(e){for(;null!=e;e=e.nextSibling){var n=e.nodeType;if(1===n||3===n)break;if(8===n){n=e.data;if("$"===n||"$!"===n||"$?"===n)break;if("/$"===n)return null}}return e}function Ml(e){e=e.previousSibling;for(var n=0;e;){if(8===e.nodeType){var t=e.data;if("$"===t||"$!"===t||"$?"===t){if(0===n)return e;n--}else"/$"===t&&n++}e=e.previousSibling}return null}var Fl=Math.random().toString(36).slice(2),Dl="__reactFiber$"+Fl,Rl="__reactProps$"+Fl,Ol="__reactContainer$"+Fl,Il="__reactEvents$"+Fl,Ul="__reactListeners$"+Fl,Vl="__reactHandles$"+Fl;function Al(e){var n=e[Dl];if(n)return n;for(var t=e.parentNode;t;){if(n=t[Ol]||t[Dl]){t=n.alternate;if(null!==n.child||null!==t&&null!==t.child)for(e=Ml(e);null!==e;){if(t=e[Dl])return t;e=Ml(e)}return n}e=t;t=e.parentNode}return null}function Bl(e){e=e[Dl]||e[Ol];return!e||5!==e.tag&&6!==e.tag&&13!==e.tag&&3!==e.tag?null:e}function Hl(e){if(5===e.tag||6===e.tag)return e.stateNode;throw Error(a(33))}function Wl(e){return e[Rl]||null}var Ql=[],jl=-1;function $l(e){return{current:e}}function Kl(e){0>jl||(e.current=Ql[jl],Ql[jl]=null,jl--)}function ql(e,n){jl++;Ql[jl]=e.current;e.current=n}var Yl={},Xl=$l(Yl),Gl=$l(!1),Zl=Yl;function Jl(e,n){var t=e.type.contextTypes;if(!t)return Yl;var r=e.stateNode;if(r&&r.__reactInternalMemoizedUnmaskedChildContext===n)return r.__reactInternalMemoizedMaskedChildContext;var l={},a;for(a in t)l[a]=n[a];r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=n,e.__reactInternalMemoizedMaskedChildContext=l);return l}function ea(e){e=e.childContextTypes;return null!==e&&void 0!==e}function na(){Kl(Gl);Kl(Xl)}function ta(e,n,t){if(Xl.current!==Yl)throw Error(a(168));ql(Xl,n);ql(Gl,t)}function ra(e,n,t){var r=e.stateNode;n=n.childContextTypes;if("function"!==typeof r.getChildContext)return t;r=r.getChildContext();for(var l in r)if(!(l in n))throw Error(a(108,$(e)||"Unknown",l));return V({},t,r)}function la(e){e=(e=e.stateNode)&&e.__reactInternalMemoizedMergedChildContext||Yl;Zl=Xl.current;ql(Xl,e);ql(Gl,Gl.current);return!0}function aa(e,n,t){var r=e.stateNode;if(!r)throw Error(a(169));t?(e=ra(e,n,Zl),r.__reactInternalMemoizedMergedChildContext=e,Kl(Gl),Kl(Xl),ql(Xl,e)):Kl(Gl);ql(Gl,t)}var ua=null,ia=!1,oa=!1;function sa(e){null===ua?ua=[e]:ua.push(e)}function ca(e){ia=!0;sa(e)}function fa(){if(!oa&&null!==ua){oa=!0;var e=0,n=Pn;try{var t=ua;for(Pn=1;e<t.length;e++){var r=t[e];do{r=r(!0)}while(null!==r)}ua=null;ia=!1}catch(l){throw null!==ua&&(ua=ua.slice(e+1)),Ze(ln,fa),l}finally{Pn=n,oa=!1}}return null}var da=[],pa=0,ma=null,ha=0,ga=[],va=0,ya=null,ba=1,ka="";function wa(e,n){da[pa++]=ha;da[pa++]=ma;ma=e;ha=n}function Sa(e,n,t){ga[va++]=ba;ga[va++]=ka;ga[va++]=ya;ya=e;var r=ba;e=ka;var l=32-pn(r)-1;r&=~(1<<l);t+=1;var a=32-pn(n)+l;if(30<a){var u=l-l%5;a=(r&(1<<u)-1).toString(32);r>>=u;l-=u;ba=1<<32-pn(n)+l|t<<l|r;ka=a+e}else ba=1<<a|t<<l|r,ka=e}function xa(e){null!==e.return&&(wa(e,1),Sa(e,1,0))}function Ea(e){for(;e===ma;)ma=da[--pa],da[pa]=null,ha=da[--pa],da[pa]=null;for(;e===ya;)ya=ga[--va],ga[va]=null,ka=ga[--va],ga[va]=null,ba=ga[--va],ga[va]=null}var Ca=null,_a=null,Na=!1,za=null;function Pa(e,n){var t=uc(5,null,null,0);t.elementType="DELETED";t.stateNode=n;t.return=e;n=e.deletions;null===n?(e.deletions=[t],e.flags|=16):n.push(t)}function Ta(e,n){switch(e.tag){case 5:var t=e.type;n=1!==n.nodeType||t.toLowerCase()!==n.nodeName.toLowerCase()?null:n;return null!==n?(e.stateNode=n,Ca=e,_a=Ll(n.firstChild),!0):!1;case 6:return n=""===e.pendingProps||3!==n.nodeType?null:n,null!==n?(e.stateNode=n,Ca=e,_a=null,!0):!1;case 13:return n=8!==n.nodeType?null:n,null!==n?(t=null!==ya?{id:ba,overflow:ka}:null,e.memoizedState={dehydrated:n,treeContext:t,retryLane:1073741824},t=uc(18,null,null,0),t.stateNode=n,t.return=e,e.child=t,Ca=e,_a=null,!0):!1;default:return!1}}function La(e){return 0!==(e.mode&1)&&0===(e.flags&128)}function Ma(e){if(Na){var n=_a;if(n){var t=n;if(!Ta(e,n)){if(La(e))throw Error(a(418));n=Ll(t.nextSibling);var r=Ca;n&&Ta(e,n)?Pa(r,t):(e.flags=e.flags&-4097|2,Na=!1,Ca=e)}}else{if(La(e))throw Error(a(418));e.flags=e.flags&-4097|2;Na=!1;Ca=e}}}function Fa(e){for(e=e.return;null!==e&&5!==e.tag&&3!==e.tag&&13!==e.tag;)e=e.return;Ca=e}function Da(e){if(e!==Ca)return!1;if(!Na)return Fa(e),Na=!0,!1;var n;(n=3!==e.tag)&&!(n=5!==e.tag)&&(n=e.type,n="head"!==n&&"body"!==n&&!El(e.type,e.memoizedProps));if(n&&(n=_a)){if(La(e))throw Ra(),Error(a(418));for(;n;)Pa(e,n),n=Ll(n.nextSibling)}Fa(e);if(13===e.tag){e=e.memoizedState;e=null!==e?e.dehydrated:null;if(!e)throw Error(a(317));e:{e=e.nextSibling;for(n=0;e;){if(8===e.nodeType){var t=e.data;if("/$"===t){if(0===n){_a=Ll(e.nextSibling);break e}n--}else"$"!==t&&"$!"!==t&&"$?"!==t||n++}e=e.nextSibling}_a=null}}else _a=Ca?Ll(e.stateNode.nextSibling):null;return!0}function Ra(){for(var e=_a;e;)e=Ll(e.nextSibling)}function Oa(){_a=Ca=null;Na=!1}function Ia(e){null===za?za=[e]:za.push(e)}var Ua=x.ReactCurrentBatchConfig;function Va(e,n){if(e&&e.defaultProps){n=V({},n);e=e.defaultProps;for(var t in e)void 0===n[t]&&(n[t]=e[t]);return n}return n}var Aa=$l(null),Ba=null,Ha=null,Wa=null;function Qa(){Wa=Ha=Ba=null}function ja(e){var n=Aa.current;Kl(Aa);e._currentValue=n}function $a(e,n,t){for(;null!==e;){var r=e.alternate;(e.childLanes&n)!==n?(e.childLanes|=n,null!==r&&(r.childLanes|=n)):null!==r&&(r.childLanes&n)!==n&&(r.childLanes|=n);if(e===t)break;e=e.return}}function Ka(e,n){Ba=e;Wa=Ha=null;e=e.dependencies;null!==e&&null!==e.firstContext&&(0!==(e.lanes&n)&&(Hi=!0),e.firstContext=null)}function qa(e){var n=e._currentValue;if(Wa!==e)if(e={context:e,memoizedValue:n,next:null},null===Ha){if(null===Ba)throw Error(a(308));Ha=e;Ba.dependencies={lanes:0,firstContext:e}}else Ha=Ha.next=e;return n}var Ya=null;function Xa(e){null===Ya?Ya=[e]:Ya.push(e)}function Ga(e,n,t,r){var l=n.interleaved;null===l?(t.next=t,Xa(n)):(t.next=l.next,l.next=t);n.interleaved=t;return Za(e,r)}function Za(e,n){e.lanes|=n;var t=e.alternate;null!==t&&(t.lanes|=n);t=e;for(e=e.return;null!==e;)e.childLanes|=n,t=e.alternate,null!==t&&(t.childLanes|=n),t=e,e=e.return;return 3===t.tag?t.stateNode:null}var Ja=!1;function eu(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function nu(e,n){e=e.updateQueue;n.updateQueue===e&&(n.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,effects:e.effects})}function tu(e,n){return{eventTime:e,lane:n,tag:0,payload:null,callback:null,next:null}}function ru(e,n,t){var r=e.updateQueue;if(null===r)return null;r=r.shared;if(0!==(es&2)){var l=r.pending;null===l?n.next=n:(n.next=l.next,l.next=n);r.pending=n;return Za(e,t)}l=r.interleaved;null===l?(n.next=n,Xa(r)):(n.next=l.next,l.next=n);r.interleaved=n;return Za(e,t)}function lu(e,n,t){n=n.updateQueue;if(null!==n&&(n=n.shared,0!==(t&4194240))){var r=n.lanes;r&=e.pendingLanes;t|=r;n.lanes=t;zn(e,t)}}function au(e,n){var t=e.updateQueue,r=e.alternate;if(null!==r&&(r=r.updateQueue,t===r)){var l=null,a=null;t=t.firstBaseUpdate;if(null!==t){do{var u={eventTime:t.eventTime,lane:t.lane,tag:t.tag,payload:t.payload,callback:t.callback,next:null};null===a?l=a=u:a=a.next=u;t=t.next}while(null!==t);null===a?l=a=n:a=a.next=n}else l=a=n;t={baseState:r.baseState,firstBaseUpdate:l,lastBaseUpdate:a,shared:r.shared,effects:r.effects};e.updateQueue=t;return}e=t.lastBaseUpdate;null===e?t.firstBaseUpdate=n:e.next=n;t.lastBaseUpdate=n}function uu(e,n,t,r){var l=e.updateQueue;Ja=!1;var a=l.firstBaseUpdate,u=l.lastBaseUpdate,i=l.shared.pending;if(null!==i){l.shared.pending=null;var o=i,s=o.next;o.next=null;null===u?a=s:u.next=s;u=o;var c=e.alternate;null!==c&&(c=c.updateQueue,i=c.lastBaseUpdate,i!==u&&(null===i?c.firstBaseUpdate=s:i.next=s,c.lastBaseUpdate=o))}if(null!==a){var f=l.baseState;u=0;c=s=o=null;i=a;do{var d=i.lane,p=i.eventTime;if((r&d)===d){null!==c&&(c=c.next={eventTime:p,lane:0,tag:i.tag,payload:i.payload,callback:i.callback,next:null});e:{var m=e,h=i;d=n;p=t;switch(h.tag){case 1:m=h.payload;if("function"===typeof m){f=m.call(p,f,d);break e}f=m;break e;case 3:m.flags=m.flags&-65537|128;case 0:m=h.payload;d="function"===typeof m?m.call(p,f,d):m;if(null===d||void 0===d)break e;f=V({},f,d);break e;case 2:Ja=!0}}null!==i.callback&&0!==i.lane&&(e.flags|=64,d=l.effects,null===d?l.effects=[i]:d.push(i))}else p={eventTime:p,lane:d,tag:i.tag,payload:i.payload,callback:i.callback,next:null},null===c?(s=c=p,o=f):c=c.next=p,u|=d;i=i.next;if(null===i)if(i=l.shared.pending,null===i)break;else d=i,i=d.next,d.next=null,l.lastBaseUpdate=d,l.shared.pending=null}while(1);null===c&&(o=f);l.baseState=o;l.firstBaseUpdate=s;l.lastBaseUpdate=c;n=l.shared.interleaved;if(null!==n){l=n;do{u|=l.lane,l=l.next}while(l!==n)}else null===a&&(l.shared.lanes=0);os|=u;e.lanes=u;e.memoizedState=f}}function iu(e,n,t){e=n.effects;n.effects=null;if(null!==e)for(n=0;n<e.length;n++){var r=e[n],l=r.callback;if(null!==l){r.callback=null;r=t;if("function"!==typeof l)throw Error(a(191,l));l.call(r)}}}var ou=(new r.Component).refs;function su(e,n,t,r){n=e.memoizedState;t=t(r,n);t=null===t||void 0===t?n:V({},n,t);e.memoizedState=t;0===e.lanes&&(e.updateQueue.baseState=t)}var cu={isMounted:function(e){return(e=e._reactInternals)?$e(e)===e:!1},enqueueSetState:function(e,n,t){e=e._reactInternals;var r=_s(),l=Ns(e),a=tu(r,l);a.payload=n;void 0!==t&&null!==t&&(a.callback=t);n=ru(e,a,l);null!==n&&(zs(n,e,l,r),lu(n,e,l))},enqueueReplaceState:function(e,n,t){e=e._reactInternals;var r=_s(),l=Ns(e),a=tu(r,l);a.tag=1;a.payload=n;void 0!==t&&null!==t&&(a.callback=t);n=ru(e,a,l);null!==n&&(zs(n,e,l,r),lu(n,e,l))},enqueueForceUpdate:function(e,n){e=e._reactInternals;var t=_s(),r=Ns(e),l=tu(t,r);l.tag=2;void 0!==n&&null!==n&&(l.callback=n);n=ru(e,l,r);null!==n&&(zs(n,e,r,t),lu(n,e,r))}};function fu(e,n,t,r,l,a,u){e=e.stateNode;return"function"===typeof e.shouldComponentUpdate?e.shouldComponentUpdate(r,a,u):n.prototype&&n.prototype.isPureReactComponent?!zr(t,r)||!zr(l,a):!0}function du(e,n,t){var r=!1,l=Yl;var a=n.contextType;"object"===typeof a&&null!==a?a=qa(a):(l=ea(n)?Zl:Xl.current,r=n.contextTypes,a=(r=null!==r&&void 0!==r)?Jl(e,l):Yl);n=new n(t,a);e.memoizedState=null!==n.state&&void 0!==n.state?n.state:null;n.updater=cu;e.stateNode=n;n._reactInternals=e;r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=l,e.__reactInternalMemoizedMaskedChildContext=a);return n}function pu(e,n,t,r){e=n.state;"function"===typeof n.componentWillReceiveProps&&n.componentWillReceiveProps(t,r);"function"===typeof n.UNSAFE_componentWillReceiveProps&&n.UNSAFE_componentWillReceiveProps(t,r);n.state!==e&&cu.enqueueReplaceState(n,n.state,null)}function mu(e,n,t,r){var l=e.stateNode;l.props=t;l.state=e.memoizedState;l.refs=ou;eu(e);var a=n.contextType;"object"===typeof a&&null!==a?l.context=qa(a):(a=ea(n)?Zl:Xl.current,l.context=Jl(e,a));l.state=e.memoizedState;a=n.getDerivedStateFromProps;"function"===typeof a&&(su(e,n,a,t),l.state=e.memoizedState);"function"===typeof n.getDerivedStateFromProps||"function"===typeof l.getSnapshotBeforeUpdate||"function"!==typeof l.UNSAFE_componentWillMount&&"function"!==typeof l.componentWillMount||(n=l.state,"function"===typeof l.componentWillMount&&l.componentWillMount(),"function"===typeof l.UNSAFE_componentWillMount&&l.UNSAFE_componentWillMount(),n!==l.state&&cu.enqueueReplaceState(l,l.state,null),uu(e,t,l,r),l.state=e.memoizedState);"function"===typeof l.componentDidMount&&(e.flags|=4194308)}function hu(e,n,t){e=t.ref;if(null!==e&&"function"!==typeof e&&"object"!==typeof e){if(t._owner){t=t._owner;if(t){if(1!==t.tag)throw Error(a(309));var r=t.stateNode}if(!r)throw Error(a(147,e));var l=r,u=""+e;if(null!==n&&null!==n.ref&&"function"===typeof n.ref&&n.ref._stringRef===u)return n.ref;n=function(e){var n=l.refs;n===ou&&(n=l.refs={});null===e?delete n[u]:n[u]=e};n._stringRef=u;return n}if("string"!==typeof e)throw Error(a(284));if(!t._owner)throw Error(a(290,e))}return e}function gu(e,n){e=Object.prototype.toString.call(n);throw Error(a(31,"[object Object]"===e?"object with keys {"+Object.keys(n).join(", ")+"}":e))}function vu(e){var n=e._init;return n(e._payload)}function yu(e){function n(n,t){if(e){var r=n.deletions;null===r?(n.deletions=[t],n.flags|=16):r.push(t)}}function t(t,r){if(!e)return null;for(;null!==r;)n(t,r),r=r.sibling;return null}function r(e,n){for(e=new Map;null!==n;)null!==n.key?e.set(n.key,n):e.set(n.index,n),n=n.sibling;return e}function l(e,n){e=sc(e,n);e.index=0;e.sibling=null;return e}function u(n,t,r){n.index=r;if(!e)return n.flags|=1048576,t;r=n.alternate;if(null!==r)return r=r.index,r<t?(n.flags|=2,t):r;n.flags|=2;return t}function i(n){e&&null===n.alternate&&(n.flags|=2);return n}function o(e,n,t,r){if(null===n||6!==n.tag)return n=pc(t,e.mode,r),n.return=e,n;n=l(n,t);n.return=e;return n}function s(e,n,t,r){var a=t.type;if(a===_)return f(e,n,t.props.children,r,t.key);if(null!==n&&(n.elementType===a||"object"===typeof a&&null!==a&&a.$$typeof===R&&vu(a)===n.type))return r=l(n,t.props),r.ref=hu(e,n,t),r.return=e,r;r=cc(t.type,t.key,t.props,null,e.mode,r);r.ref=hu(e,n,t);r.return=e;return r}function c(e,n,t,r){if(null===n||4!==n.tag||n.stateNode.containerInfo!==t.containerInfo||n.stateNode.implementation!==t.implementation)return n=mc(t,e.mode,r),n.return=e,n;n=l(n,t.children||[]);n.return=e;return n}function f(e,n,t,r,a){if(null===n||7!==n.tag)return n=fc(t,e.mode,r,a),n.return=e,n;n=l(n,t);n.return=e;return n}function d(e,n,t){if("string"===typeof n&&""!==n||"number"===typeof n)return n=pc(""+n,e.mode,t),n.return=e,n;if("object"===typeof n&&null!==n){switch(n.$$typeof){case E:return t=cc(n.type,n.key,n.props,null,e.mode,t),t.ref=hu(e,null,n),t.return=e,t;case C:return n=mc(n,e.mode,t),n.return=e,n;case R:var r=n._init;return d(e,r(n._payload),t)}if(ae(n)||U(n))return n=fc(n,e.mode,t,null),n.return=e,n;gu(e,n)}return null}function p(e,n,t,r){var l=null!==n?n.key:null;if("string"===typeof t&&""!==t||"number"===typeof t)return null!==l?null:o(e,n,""+t,r);if("object"===typeof t&&null!==t){switch(t.$$typeof){case E:return t.key===l?s(e,n,t,r):null;case C:return t.key===l?c(e,n,t,r):null;case R:return l=t._init,p(e,n,l(t._payload),r)}if(ae(t)||U(t))return null!==l?null:f(e,n,t,r,null);gu(e,t)}return null}function m(e,n,t,r,l){if("string"===typeof r&&""!==r||"number"===typeof r)return e=e.get(t)||null,o(n,e,""+r,l);if("object"===typeof r&&null!==r){switch(r.$$typeof){case E:return e=e.get(null===r.key?t:r.key)||null,s(n,e,r,l);case C:return e=e.get(null===r.key?t:r.key)||null,c(n,e,r,l);case R:var a=r._init;return m(e,n,t,a(r._payload),l)}if(ae(r)||U(r))return e=e.get(t)||null,f(n,e,r,l,null);gu(n,r)}return null}function h(l,a,i,o){for(var s=null,c=null,f=a,h=a=0,g=null;null!==f&&h<i.length;h++){f.index>h?(g=f,f=null):g=f.sibling;var v=p(l,f,i[h],o);if(null===v){null===f&&(f=g);break}e&&f&&null===v.alternate&&n(l,f);a=u(v,a,h);null===c?s=v:c.sibling=v;c=v;f=g}if(h===i.length)return t(l,f),Na&&wa(l,h),s;if(null===f){for(;h<i.length;h++)f=d(l,i[h],o),null!==f&&(a=u(f,a,h),null===c?s=f:c.sibling=f,c=f);Na&&wa(l,h);return s}for(f=r(l,f);h<i.length;h++)g=m(f,l,h,i[h],o),null!==g&&(e&&null!==g.alternate&&f.delete(null===g.key?h:g.key),a=u(g,a,h),null===c?s=g:c.sibling=g,c=g);e&&f.forEach((function(e){return n(l,e)}));Na&&wa(l,h);return s}function g(l,i,o,s){var c=U(o);if("function"!==typeof c)throw Error(a(150));o=c.call(o);if(null==o)throw Error(a(151));for(var f=c=null,h=i,g=i=0,v=null,y=o.next();null!==h&&!y.done;g++,y=o.next()){h.index>g?(v=h,h=null):v=h.sibling;var b=p(l,h,y.value,s);if(null===b){null===h&&(h=v);break}e&&h&&null===b.alternate&&n(l,h);i=u(b,i,g);null===f?c=b:f.sibling=b;f=b;h=v}if(y.done)return t(l,h),Na&&wa(l,g),c;if(null===h){for(;!y.done;g++,y=o.next())y=d(l,y.value,s),null!==y&&(i=u(y,i,g),null===f?c=y:f.sibling=y,f=y);Na&&wa(l,g);return c}for(h=r(l,h);!y.done;g++,y=o.next())y=m(h,l,g,y.value,s),null!==y&&(e&&null!==y.alternate&&h.delete(null===y.key?g:y.key),i=u(y,i,g),null===f?c=y:f.sibling=y,f=y);e&&h.forEach((function(e){return n(l,e)}));Na&&wa(l,g);return c}function v(e,r,a,u){"object"===typeof a&&null!==a&&a.type===_&&null===a.key&&(a=a.props.children);if("object"===typeof a&&null!==a){switch(a.$$typeof){case E:e:{for(var o=a.key,s=r;null!==s;){if(s.key===o){o=a.type;if(o===_){if(7===s.tag){t(e,s.sibling);r=l(s,a.props.children);r.return=e;e=r;break e}}else if(s.elementType===o||"object"===typeof o&&null!==o&&o.$$typeof===R&&vu(o)===s.type){t(e,s.sibling);r=l(s,a.props);r.ref=hu(e,s,a);r.return=e;e=r;break e}t(e,s);break}else n(e,s);s=s.sibling}a.type===_?(r=fc(a.props.children,e.mode,u,a.key),r.return=e,e=r):(u=cc(a.type,a.key,a.props,null,e.mode,u),u.ref=hu(e,r,a),u.return=e,e=u)}return i(e);case C:e:{for(s=a.key;null!==r;){if(r.key===s)if(4===r.tag&&r.stateNode.containerInfo===a.containerInfo&&r.stateNode.implementation===a.implementation){t(e,r.sibling);r=l(r,a.children||[]);r.return=e;e=r;break e}else{t(e,r);break}else n(e,r);r=r.sibling}r=mc(a,e.mode,u);r.return=e;e=r}return i(e);case R:return s=a._init,v(e,r,s(a._payload),u)}if(ae(a))return h(e,r,a,u);if(U(a))return g(e,r,a,u);gu(e,a)}return"string"===typeof a&&""!==a||"number"===typeof a?(a=""+a,null!==r&&6===r.tag?(t(e,r.sibling),r=l(r,a),r.return=e,e=r):(t(e,r),r=pc(a,e.mode,u),r.return=e,e=r),i(e)):t(e,r)}return v}var bu=yu(!0),ku=yu(!1),wu={},Su=$l(wu),xu=$l(wu),Eu=$l(wu);function Cu(e){if(e===wu)throw Error(a(174));return e}function _u(e,n){ql(Eu,n);ql(xu,e);ql(Su,wu);e=n.nodeType;switch(e){case 9:case 11:n=(n=n.documentElement)?n.namespaceURI:de(null,"");break;default:e=8===e?n.parentNode:n,n=e.namespaceURI||null,e=e.tagName,n=de(n,e)}Kl(Su);ql(Su,n)}function Nu(){Kl(Su);Kl(xu);Kl(Eu)}function zu(e){Cu(Eu.current);var n=Cu(Su.current);var t=de(n,e.type);n!==t&&(ql(xu,e),ql(Su,t))}function Pu(e){xu.current===e&&(Kl(Su),Kl(xu))}var Tu=$l(0);function Lu(e){for(var n=e;null!==n;){if(13===n.tag){var t=n.memoizedState;if(null!==t&&(t=t.dehydrated,null===t||"$?"===t.data||"$!"===t.data))return n}else if(19===n.tag&&void 0!==n.memoizedProps.revealOrder){if(0!==(n.flags&128))return n}else if(null!==n.child){n.child.return=n;n=n.child;continue}if(n===e)break;for(;null===n.sibling;){if(null===n.return||n.return===e)return null;n=n.return}n.sibling.return=n.return;n=n.sibling}return null}var Mu=[];function Fu(){for(var e=0;e<Mu.length;e++)Mu[e]._workInProgressVersionPrimary=null;Mu.length=0}var Du=x.ReactCurrentDispatcher,Ru=x.ReactCurrentBatchConfig,Ou=0,Iu=null,Uu=null,Vu=null,Au=!1,Bu=!1,Hu=0,Wu=0;function Qu(){throw Error(a(321))}function ju(e,n){if(null===n)return!1;for(var t=0;t<n.length&&t<e.length;t++)if(!Nr(e[t],n[t]))return!1;return!0}function $u(e,n,t,r,l,u){Ou=u;Iu=n;n.memoizedState=null;n.updateQueue=null;n.lanes=0;Du.current=null===e||null===e.memoizedState?Pi:Ti;e=t(r,l);if(Bu){u=0;do{Bu=!1;Hu=0;if(25<=u)throw Error(a(301));u+=1;Vu=Uu=null;n.updateQueue=null;Du.current=Li;e=t(r,l)}while(Bu)}Du.current=zi;n=null!==Uu&&null!==Uu.next;Ou=0;Vu=Uu=Iu=null;Au=!1;if(n)throw Error(a(300));return e}function Ku(){var e=0!==Hu;Hu=0;return e}function qu(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};null===Vu?Iu.memoizedState=Vu=e:Vu=Vu.next=e;return Vu}function Yu(){if(null===Uu){var e=Iu.alternate;e=null!==e?e.memoizedState:null}else e=Uu.next;var n=null===Vu?Iu.memoizedState:Vu.next;if(null!==n)Vu=n,Uu=e;else{if(null===e)throw Error(a(310));Uu=e;e={memoizedState:Uu.memoizedState,baseState:Uu.baseState,baseQueue:Uu.baseQueue,queue:Uu.queue,next:null};null===Vu?Iu.memoizedState=Vu=e:Vu=Vu.next=e}return Vu}function Xu(e,n){return"function"===typeof n?n(e):n}function Gu(e){var n=Yu(),t=n.queue;if(null===t)throw Error(a(311));t.lastRenderedReducer=e;var r=Uu,l=r.baseQueue,u=t.pending;if(null!==u){if(null!==l){var i=l.next;l.next=u.next;u.next=i}r.baseQueue=l=u;t.pending=null}if(null!==l){u=l.next;r=r.baseState;var o=i=null,s=null,c=u;do{var f=c.lane;if((Ou&f)===f)null!==s&&(s=s.next={lane:0,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),r=c.hasEagerState?c.eagerState:e(r,c.action);else{var d={lane:f,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null};null===s?(o=s=d,i=r):s=s.next=d;Iu.lanes|=f;os|=f}c=c.next}while(null!==c&&c!==u);null===s?i=r:s.next=o;Nr(r,n.memoizedState)||(Hi=!0);n.memoizedState=r;n.baseState=i;n.baseQueue=s;t.lastRenderedState=r}e=t.interleaved;if(null!==e){l=e;do{u=l.lane,Iu.lanes|=u,os|=u,l=l.next}while(l!==e)}else null===l&&(t.lanes=0);return[n.memoizedState,t.dispatch]}function Zu(e){var n=Yu(),t=n.queue;if(null===t)throw Error(a(311));t.lastRenderedReducer=e;var r=t.dispatch,l=t.pending,u=n.memoizedState;if(null!==l){t.pending=null;var i=l=l.next;do{u=e(u,i.action),i=i.next}while(i!==l);Nr(u,n.memoizedState)||(Hi=!0);n.memoizedState=u;null===n.baseQueue&&(n.baseState=u);t.lastRenderedState=u}return[u,r]}function Ju(){}function ei(e,n){var t=Iu,r=Yu(),l=n(),u=!Nr(r.memoizedState,l);u&&(r.memoizedState=l,Hi=!0);r=r.queue;di(ri.bind(null,t,r,e),[e]);if(r.getSnapshot!==n||u||null!==Vu&&Vu.memoizedState.tag&1){t.flags|=2048;ii(9,ti.bind(null,t,r,l,n),void 0,null);if(null===ns)throw Error(a(349));0!==(Ou&30)||ni(t,n,l)}return l}function ni(e,n,t){e.flags|=16384;e={getSnapshot:n,value:t};n=Iu.updateQueue;null===n?(n={lastEffect:null,stores:null},Iu.updateQueue=n,n.stores=[e]):(t=n.stores,null===t?n.stores=[e]:t.push(e))}function ti(e,n,t,r){n.value=t;n.getSnapshot=r;li(n)&&ai(e)}function ri(e,n,t){return t((function(){li(n)&&ai(e)}))}function li(e){var n=e.getSnapshot;e=e.value;try{var t=n();return!Nr(e,t)}catch(r){return!0}}function ai(e){var n=Za(e,1);null!==n&&zs(n,e,1,-1)}function ui(e){var n=qu();"function"===typeof e&&(e=e());n.memoizedState=n.baseState=e;e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:Xu,lastRenderedState:e};n.queue=e;e=e.dispatch=Ei.bind(null,Iu,e);return[n.memoizedState,e]}function ii(e,n,t,r){e={tag:e,create:n,destroy:t,deps:r,next:null};n=Iu.updateQueue;null===n?(n={lastEffect:null,stores:null},Iu.updateQueue=n,n.lastEffect=e.next=e):(t=n.lastEffect,null===t?n.lastEffect=e.next=e:(r=t.next,t.next=e,e.next=r,n.lastEffect=e));return e}function oi(){return Yu().memoizedState}function si(e,n,t,r){var l=qu();Iu.flags|=e;l.memoizedState=ii(1|n,t,void 0,void 0===r?null:r)}function ci(e,n,t,r){var l=Yu();r=void 0===r?null:r;var a=void 0;if(null!==Uu){var u=Uu.memoizedState;a=u.destroy;if(null!==r&&ju(r,u.deps)){l.memoizedState=ii(n,t,a,r);return}}Iu.flags|=e;l.memoizedState=ii(1|n,t,a,r)}function fi(e,n){return si(8390656,8,e,n)}function di(e,n){return ci(2048,8,e,n)}function pi(e,n){return ci(4,2,e,n)}function mi(e,n){return ci(4,4,e,n)}function hi(e,n){if("function"===typeof n)return e=e(),n(e),function(){n(null)};if(null!==n&&void 0!==n)return e=e(),n.current=e,function(){n.current=null}}function gi(e,n,t){t=null!==t&&void 0!==t?t.concat([e]):null;return ci(4,4,hi.bind(null,n,e),t)}function vi(){}function yi(e,n){var t=Yu();n=void 0===n?null:n;var r=t.memoizedState;if(null!==r&&null!==n&&ju(n,r[1]))return r[0];t.memoizedState=[e,n];return e}function bi(e,n){var t=Yu();n=void 0===n?null:n;var r=t.memoizedState;if(null!==r&&null!==n&&ju(n,r[1]))return r[0];e=e();t.memoizedState=[e,n];return e}function ki(e,n,t){if(0===(Ou&21))return e.baseState&&(e.baseState=!1,Hi=!0),e.memoizedState=t;Nr(t,n)||(t=En(),Iu.lanes|=t,os|=t,e.baseState=!0);return n}function wi(e,n){var t=Pn;Pn=0!==t&&4>t?t:4;e(!0);var r=Ru.transition;Ru.transition={};try{e(!1),n()}finally{Pn=t,Ru.transition=r}}function Si(){return Yu().memoizedState}function xi(e,n,t){var r=Ns(e);t={lane:r,action:t,hasEagerState:!1,eagerState:null,next:null};if(Ci(e))_i(n,t);else if(t=Ga(e,n,t,r),null!==t){var l=_s();zs(t,e,r,l);Ni(t,n,r)}}function Ei(e,n,t){var r=Ns(e),l={lane:r,action:t,hasEagerState:!1,eagerState:null,next:null};if(Ci(e))_i(n,l);else{var a=e.alternate;if(0===e.lanes&&(null===a||0===a.lanes)&&(a=n.lastRenderedReducer,null!==a))try{var u=n.lastRenderedState,i=a(u,t);l.hasEagerState=!0;l.eagerState=i;if(Nr(i,u)){var o=n.interleaved;null===o?(l.next=l,Xa(n)):(l.next=o.next,o.next=l);n.interleaved=l;return}}catch(s){}finally{}t=Ga(e,n,l,r);null!==t&&(l=_s(),zs(t,e,r,l),Ni(t,n,r))}}function Ci(e){var n=e.alternate;return e===Iu||null!==n&&n===Iu}function _i(e,n){Bu=Au=!0;var t=e.pending;null===t?n.next=n:(n.next=t.next,t.next=n);e.pending=n}function Ni(e,n,t){if(0!==(t&4194240)){var r=n.lanes;r&=e.pendingLanes;t|=r;n.lanes=t;zn(e,t)}}var zi={readContext:qa,useCallback:Qu,useContext:Qu,useEffect:Qu,useImperativeHandle:Qu,useInsertionEffect:Qu,useLayoutEffect:Qu,useMemo:Qu,useReducer:Qu,useRef:Qu,useState:Qu,useDebugValue:Qu,useDeferredValue:Qu,useTransition:Qu,useMutableSource:Qu,useSyncExternalStore:Qu,useId:Qu,unstable_isNewReconciler:!1},Pi={readContext:qa,useCallback:function(e,n){qu().memoizedState=[e,void 0===n?null:n];return e},useContext:qa,useEffect:fi,useImperativeHandle:function(e,n,t){t=null!==t&&void 0!==t?t.concat([e]):null;return si(4194308,4,hi.bind(null,n,e),t)},useLayoutEffect:function(e,n){return si(4194308,4,e,n)},useInsertionEffect:function(e,n){return si(4,2,e,n)},useMemo:function(e,n){var t=qu();n=void 0===n?null:n;e=e();t.memoizedState=[e,n];return e},useReducer:function(e,n,t){var r=qu();n=void 0!==t?t(n):n;r.memoizedState=r.baseState=n;e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:n};r.queue=e;e=e.dispatch=xi.bind(null,Iu,e);return[r.memoizedState,e]},useRef:function(e){var n=qu();e={current:e};return n.memoizedState=e},useState:ui,useDebugValue:vi,useDeferredValue:function(e){return qu().memoizedState=e},useTransition:function(){var e=ui(!1),n=e[0];e=wi.bind(null,e[1]);qu().memoizedState=e;return[n,e]},useMutableSource:function(){},useSyncExternalStore:function(e,n,t){var r=Iu,l=qu();if(Na){if(void 0===t)throw Error(a(407));t=t()}else{t=n();if(null===ns)throw Error(a(349));0!==(Ou&30)||ni(r,n,t)}l.memoizedState=t;var u={value:t,getSnapshot:n};l.queue=u;fi(ri.bind(null,r,u,e),[e]);r.flags|=2048;ii(9,ti.bind(null,r,u,t,n),void 0,null);return t},useId:function(){var e=qu(),n=ns.identifierPrefix;if(Na){var t=ka;var r=ba;t=(r&~(1<<32-pn(r)-1)).toString(32)+t;n=":"+n+"R"+t;t=Hu++;0<t&&(n+="H"+t.toString(32));n+=":"}else t=Wu++,n=":"+n+"r"+t.toString(32)+":";return e.memoizedState=n},unstable_isNewReconciler:!1},Ti={readContext:qa,useCallback:yi,useContext:qa,useEffect:di,useImperativeHandle:gi,useInsertionEffect:pi,useLayoutEffect:mi,useMemo:bi,useReducer:Gu,useRef:oi,useState:function(){return Gu(Xu)},useDebugValue:vi,useDeferredValue:function(e){var n=Yu();return ki(n,Uu.memoizedState,e)},useTransition:function(){var e=Gu(Xu)[0],n=Yu().memoizedState;return[e,n]},useMutableSource:Ju,useSyncExternalStore:ei,useId:Si,unstable_isNewReconciler:!1},Li={readContext:qa,useCallback:yi,useContext:qa,useEffect:di,useImperativeHandle:gi,useInsertionEffect:pi,useLayoutEffect:mi,useMemo:bi,useReducer:Zu,useRef:oi,useState:function(){return Zu(Xu)},useDebugValue:vi,useDeferredValue:function(e){var n=Yu();return null===Uu?n.memoizedState=e:ki(n,Uu.memoizedState,e)},useTransition:function(){var e=Zu(Xu)[0],n=Yu().memoizedState;return[e,n]},useMutableSource:Ju,useSyncExternalStore:ei,useId:Si,unstable_isNewReconciler:!1};function Mi(e,n){try{var t="",r=n;do{t+=Q(r),r=r.return}while(r);var l=t}catch(a){l="\nError generating stack: "+a.message+"\n"+a.stack}return{value:e,source:n,stack:l,digest:null}}function Fi(e,n,t){return{value:e,source:null,stack:null!=t?t:null,digest:null!=n?n:null}}function Di(e,n){try{console.error(n.value)}catch(t){setTimeout((function(){throw t}))}}var Ri="function"===typeof WeakMap?WeakMap:Map;function Oi(e,n,t){t=tu(-1,t);t.tag=3;t.payload={element:null};var r=n.value;t.callback=function(){gs||(gs=!0,vs=r);Di(e,n)};return t}function Ii(e,n,t){t=tu(-1,t);t.tag=3;var r=e.type.getDerivedStateFromError;if("function"===typeof r){var l=n.value;t.payload=function(){return r(l)};t.callback=function(){Di(e,n)}}var a=e.stateNode;null!==a&&"function"===typeof a.componentDidCatch&&(t.callback=function(){Di(e,n);"function"!==typeof r&&(null===ys?ys=new Set([this]):ys.add(this));var t=n.stack;this.componentDidCatch(n.value,{componentStack:null!==t?t:""})});return t}function Ui(e,n,t){var r=e.pingCache;if(null===r){r=e.pingCache=new Ri;var l=new Set;r.set(n,l)}else l=r.get(n),void 0===l&&(l=new Set,r.set(n,l));l.has(t)||(l.add(t),e=Js.bind(null,e,n,t),n.then(e,e))}function Vi(e){do{var n;if(n=13===e.tag)n=e.memoizedState,n=null!==n?null!==n.dehydrated?!0:!1:!0;if(n)return e;e=e.return}while(null!==e);return null}function Ai(e,n,t,r,l){if(0===(e.mode&1))return e===n?e.flags|=65536:(e.flags|=128,t.flags|=131072,t.flags&=-52805,1===t.tag&&(null===t.alternate?t.tag=17:(n=tu(-1,1),n.tag=2,ru(t,n,1))),t.lanes|=1),e;e.flags|=65536;e.lanes=l;return e}var Bi=x.ReactCurrentOwner,Hi=!1;function Wi(e,n,t,r){n.child=null===e?ku(n,null,t,r):bu(n,e.child,t,r)}function Qi(e,n,t,r,l){t=t.render;var a=n.ref;Ka(n,l);r=$u(e,n,t,r,a,l);t=Ku();if(null!==e&&!Hi)return n.updateQueue=e.updateQueue,n.flags&=-2053,e.lanes&=~l,co(e,n,l);Na&&t&&xa(n);n.flags|=1;Wi(e,n,r,l);return n.child}function ji(e,n,t,r,l){if(null===e){var a=t.type;if("function"===typeof a&&!ic(a)&&void 0===a.defaultProps&&null===t.compare&&void 0===t.defaultProps)return n.tag=15,n.type=a,$i(e,n,a,r,l);e=cc(t.type,null,r,n,n.mode,l);e.ref=n.ref;e.return=n;return n.child=e}a=e.child;if(0===(e.lanes&l)){var u=a.memoizedProps;t=t.compare;t=null!==t?t:zr;if(t(u,r)&&e.ref===n.ref)return co(e,n,l)}n.flags|=1;e=sc(a,r);e.ref=n.ref;e.return=n;return n.child=e}function $i(e,n,t,r,l){if(null!==e){var a=e.memoizedProps;if(zr(a,r)&&e.ref===n.ref)if(Hi=!1,n.pendingProps=r=a,0!==(e.lanes&l))0!==(e.flags&131072)&&(Hi=!0);else return n.lanes=e.lanes,co(e,n,l)}return Yi(e,n,t,r,l)}function Ki(e,n,t){var r=n.pendingProps,l=r.children,a=null!==e?e.memoizedState:null;if("hidden"===r.mode)if(0===(n.mode&1))n.memoizedState={baseLanes:0,cachePool:null,transitions:null},ql(as,ls),ls|=t;else{if(0===(t&1073741824))return e=null!==a?a.baseLanes|t:t,n.lanes=n.childLanes=1073741824,n.memoizedState={baseLanes:e,cachePool:null,transitions:null},n.updateQueue=null,ql(as,ls),ls|=e,null;n.memoizedState={baseLanes:0,cachePool:null,transitions:null};r=null!==a?a.baseLanes:t;ql(as,ls);ls|=r}else null!==a?(r=a.baseLanes|t,n.memoizedState=null):r=t,ql(as,ls),ls|=r;Wi(e,n,l,t);return n.child}function qi(e,n){var t=n.ref;if(null===e&&null!==t||null!==e&&e.ref!==t)n.flags|=512,n.flags|=2097152}function Yi(e,n,t,r,l){var a=ea(t)?Zl:Xl.current;a=Jl(n,a);Ka(n,l);t=$u(e,n,t,r,a,l);r=Ku();if(null!==e&&!Hi)return n.updateQueue=e.updateQueue,n.flags&=-2053,e.lanes&=~l,co(e,n,l);Na&&r&&xa(n);n.flags|=1;Wi(e,n,t,l);return n.child}function Xi(e,n,t,r,l){if(ea(t)){var a=!0;la(n)}else a=!1;Ka(n,l);if(null===n.stateNode)so(e,n),du(n,t,r),mu(n,t,r,l),r=!0;else if(null===e){var u=n.stateNode,i=n.memoizedProps;u.props=i;var o=u.context,s=t.contextType;"object"===typeof s&&null!==s?s=qa(s):(s=ea(t)?Zl:Xl.current,s=Jl(n,s));var c=t.getDerivedStateFromProps,f="function"===typeof c||"function"===typeof u.getSnapshotBeforeUpdate;f||"function"!==typeof u.UNSAFE_componentWillReceiveProps&&"function"!==typeof u.componentWillReceiveProps||(i!==r||o!==s)&&pu(n,u,r,s);Ja=!1;var d=n.memoizedState;u.state=d;uu(n,r,u,l);o=n.memoizedState;i!==r||d!==o||Gl.current||Ja?("function"===typeof c&&(su(n,t,c,r),o=n.memoizedState),(i=Ja||fu(n,t,i,r,d,o,s))?(f||"function"!==typeof u.UNSAFE_componentWillMount&&"function"!==typeof u.componentWillMount||("function"===typeof u.componentWillMount&&u.componentWillMount(),"function"===typeof u.UNSAFE_componentWillMount&&u.UNSAFE_componentWillMount()),"function"===typeof u.componentDidMount&&(n.flags|=4194308)):("function"===typeof u.componentDidMount&&(n.flags|=4194308),n.memoizedProps=r,n.memoizedState=o),u.props=r,u.state=o,u.context=s,r=i):("function"===typeof u.componentDidMount&&(n.flags|=4194308),r=!1)}else{u=n.stateNode;nu(e,n);i=n.memoizedProps;s=n.type===n.elementType?i:Va(n.type,i);u.props=s;f=n.pendingProps;d=u.context;o=t.contextType;"object"===typeof o&&null!==o?o=qa(o):(o=ea(t)?Zl:Xl.current,o=Jl(n,o));var p=t.getDerivedStateFromProps;(c="function"===typeof p||"function"===typeof u.getSnapshotBeforeUpdate)||"function"!==typeof u.UNSAFE_componentWillReceiveProps&&"function"!==typeof u.componentWillReceiveProps||(i!==f||d!==o)&&pu(n,u,r,o);Ja=!1;d=n.memoizedState;u.state=d;uu(n,r,u,l);var m=n.memoizedState;i!==f||d!==m||Gl.current||Ja?("function"===typeof p&&(su(n,t,p,r),m=n.memoizedState),(s=Ja||fu(n,t,s,r,d,m,o)||!1)?(c||"function"!==typeof u.UNSAFE_componentWillUpdate&&"function"!==typeof u.componentWillUpdate||("function"===typeof u.componentWillUpdate&&u.componentWillUpdate(r,m,o),"function"===typeof u.UNSAFE_componentWillUpdate&&u.UNSAFE_componentWillUpdate(r,m,o)),"function"===typeof u.componentDidUpdate&&(n.flags|=4),"function"===typeof u.getSnapshotBeforeUpdate&&(n.flags|=1024)):("function"!==typeof u.componentDidUpdate||i===e.memoizedProps&&d===e.memoizedState||(n.flags|=4),"function"!==typeof u.getSnapshotBeforeUpdate||i===e.memoizedProps&&d===e.memoizedState||(n.flags|=1024),n.memoizedProps=r,n.memoizedState=m),u.props=r,u.state=m,u.context=o,r=s):("function"!==typeof u.componentDidUpdate||i===e.memoizedProps&&d===e.memoizedState||(n.flags|=4),"function"!==typeof u.getSnapshotBeforeUpdate||i===e.memoizedProps&&d===e.memoizedState||(n.flags|=1024),r=!1)}return Gi(e,n,t,r,a,l)}function Gi(e,n,t,r,l,a){qi(e,n);var u=0!==(n.flags&128);if(!r&&!u)return l&&aa(n,t,!1),co(e,n,a);r=n.stateNode;Bi.current=n;var i=u&&"function"!==typeof t.getDerivedStateFromError?null:r.render();n.flags|=1;null!==e&&u?(n.child=bu(n,e.child,null,a),n.child=bu(n,null,i,a)):Wi(e,n,i,a);n.memoizedState=r.state;l&&aa(n,t,!0);return n.child}function Zi(e){var n=e.stateNode;n.pendingContext?ta(e,n.pendingContext,n.pendingContext!==n.context):n.context&&ta(e,n.context,!1);_u(e,n.containerInfo)}function Ji(e,n,t,r,l){Oa();Ia(l);n.flags|=256;Wi(e,n,t,r);return n.child}var eo={dehydrated:null,treeContext:null,retryLane:0};function no(e){return{baseLanes:e,cachePool:null,transitions:null}}function to(e,n,t){var r=n.pendingProps,l=Tu.current,a=!1,u=0!==(n.flags&128),i;(i=u)||(i=null!==e&&null===e.memoizedState?!1:0!==(l&2));if(i)a=!0,n.flags&=-129;else if(null===e||null!==e.memoizedState)l|=1;ql(Tu,l&1);if(null===e){Ma(n);e=n.memoizedState;if(null!==e&&(e=e.dehydrated,null!==e))return 0===(n.mode&1)?n.lanes=1:"$!"===e.data?n.lanes=8:n.lanes=1073741824,null;u=r.children;e=r.fallback;return a?(r=n.mode,a=n.child,u={mode:"hidden",children:u},0===(r&1)&&null!==a?(a.childLanes=0,a.pendingProps=u):a=dc(u,r,0,null),e=fc(e,r,t,null),a.return=n,e.return=n,a.sibling=e,n.child=a,n.child.memoizedState=no(t),n.memoizedState=eo,e):ro(n,u)}l=e.memoizedState;if(null!==l&&(i=l.dehydrated,null!==i))return ao(e,n,u,r,i,l,t);if(a){a=r.fallback;u=n.mode;l=e.child;i=l.sibling;var o={mode:"hidden",children:r.children};0===(u&1)&&n.child!==l?(r=n.child,r.childLanes=0,r.pendingProps=o,n.deletions=null):(r=sc(l,o),r.subtreeFlags=l.subtreeFlags&14680064);null!==i?a=sc(i,a):(a=fc(a,u,t,null),a.flags|=2);a.return=n;r.return=n;r.sibling=a;n.child=r;r=a;a=n.child;u=e.child.memoizedState;u=null===u?no(t):{baseLanes:u.baseLanes|t,cachePool:null,transitions:u.transitions};a.memoizedState=u;a.childLanes=e.childLanes&~t;n.memoizedState=eo;return r}a=e.child;e=a.sibling;r=sc(a,{mode:"visible",children:r.children});0===(n.mode&1)&&(r.lanes=t);r.return=n;r.sibling=null;null!==e&&(t=n.deletions,null===t?(n.deletions=[e],n.flags|=16):t.push(e));n.child=r;n.memoizedState=null;return r}function ro(e,n){n=dc({mode:"visible",children:n},e.mode,0,null);n.return=e;return e.child=n}function lo(e,n,t,r){null!==r&&Ia(r);bu(n,e.child,null,t);e=ro(n,n.pendingProps.children);e.flags|=2;n.memoizedState=null;return e}function ao(e,n,t,r,l,u,i){if(t){if(n.flags&256)return n.flags&=-257,r=Fi(Error(a(422))),lo(e,n,i,r);if(null!==n.memoizedState)return n.child=e.child,n.flags|=128,null;u=r.fallback;l=n.mode;r=dc({mode:"visible",children:r.children},l,0,null);u=fc(u,l,i,null);u.flags|=2;r.return=n;u.return=n;r.sibling=u;n.child=r;0!==(n.mode&1)&&bu(n,e.child,null,i);n.child.memoizedState=no(i);n.memoizedState=eo;return u}if(0===(n.mode&1))return lo(e,n,i,null);if("$!"===l.data){r=l.nextSibling&&l.nextSibling.dataset;if(r)var o=r.dgst;r=o;u=Error(a(419));r=Fi(u,r,void 0);return lo(e,n,i,r)}o=0!==(i&e.childLanes);if(Hi||o){r=ns;if(null!==r){switch(i&-i){case 4:l=2;break;case 16:l=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:l=32;break;case 536870912:l=268435456;break;default:l=0}l=0!==(l&(r.suspendedLanes|i))?0:l;0!==l&&l!==u.retryLane&&(u.retryLane=l,Za(e,l),zs(r,e,l,-1))}Hs();r=Fi(Error(a(421)));return lo(e,n,i,r)}if("$?"===l.data)return n.flags|=128,n.child=e.child,n=nc.bind(null,e),l._reactRetry=n,null;e=u.treeContext;_a=Ll(l.nextSibling);Ca=n;Na=!0;za=null;null!==e&&(ga[va++]=ba,ga[va++]=ka,ga[va++]=ya,ba=e.id,ka=e.overflow,ya=n);n=ro(n,r.children);n.flags|=4096;return n}function uo(e,n,t){e.lanes|=n;var r=e.alternate;null!==r&&(r.lanes|=n);$a(e.return,n,t)}function io(e,n,t,r,l){var a=e.memoizedState;null===a?e.memoizedState={isBackwards:n,rendering:null,renderingStartTime:0,last:r,tail:t,tailMode:l}:(a.isBackwards=n,a.rendering=null,a.renderingStartTime=0,a.last=r,a.tail=t,a.tailMode=l)}function oo(e,n,t){var r=n.pendingProps,l=r.revealOrder,a=r.tail;Wi(e,n,r.children,t);r=Tu.current;if(0!==(r&2))r=r&1|2,n.flags|=128;else{if(null!==e&&0!==(e.flags&128))e:for(e=n.child;null!==e;){if(13===e.tag)null!==e.memoizedState&&uo(e,t,n);else if(19===e.tag)uo(e,t,n);else if(null!==e.child){e.child.return=e;e=e.child;continue}if(e===n)break e;for(;null===e.sibling;){if(null===e.return||e.return===n)break e;e=e.return}e.sibling.return=e.return;e=e.sibling}r&=1}ql(Tu,r);if(0===(n.mode&1))n.memoizedState=null;else switch(l){case"forwards":t=n.child;for(l=null;null!==t;)e=t.alternate,null!==e&&null===Lu(e)&&(l=t),t=t.sibling;t=l;null===t?(l=n.child,n.child=null):(l=t.sibling,t.sibling=null);io(n,!1,l,t,a);break;case"backwards":t=null;l=n.child;for(n.child=null;null!==l;){e=l.alternate;if(null!==e&&null===Lu(e)){n.child=l;break}e=l.sibling;l.sibling=t;t=l;l=e}io(n,!0,t,null,a);break;case"together":io(n,!1,null,null,void 0);break;default:n.memoizedState=null}return n.child}function so(e,n){0===(n.mode&1)&&null!==e&&(e.alternate=null,n.alternate=null,n.flags|=2)}function co(e,n,t){null!==e&&(n.dependencies=e.dependencies);os|=n.lanes;if(0===(t&n.childLanes))return null;if(null!==e&&n.child!==e.child)throw Error(a(153));if(null!==n.child){e=n.child;t=sc(e,e.pendingProps);n.child=t;for(t.return=n;null!==e.sibling;)e=e.sibling,t=t.sibling=sc(e,e.pendingProps),t.return=n;t.sibling=null}return n.child}function fo(e,n,t){switch(n.tag){case 3:Zi(n);Oa();break;case 5:zu(n);break;case 1:ea(n.type)&&la(n);break;case 4:_u(n,n.stateNode.containerInfo);break;case 10:var r=n.type._context,l=n.memoizedProps.value;ql(Aa,r._currentValue);r._currentValue=l;break;case 13:r=n.memoizedState;if(null!==r){if(null!==r.dehydrated)return ql(Tu,Tu.current&1),n.flags|=128,null;if(0!==(t&n.child.childLanes))return to(e,n,t);ql(Tu,Tu.current&1);e=co(e,n,t);return null!==e?e.sibling:null}ql(Tu,Tu.current&1);break;case 19:r=0!==(t&n.childLanes);if(0!==(e.flags&128)){if(r)return oo(e,n,t);n.flags|=128}l=n.memoizedState;null!==l&&(l.rendering=null,l.tail=null,l.lastEffect=null);ql(Tu,Tu.current);if(r)break;else return null;case 22:case 23:return n.lanes=0,Ki(e,n,t)}return co(e,n,t)}var po,mo,ho,go;po=function(e,n){for(var t=n.child;null!==t;){if(5===t.tag||6===t.tag)e.appendChild(t.stateNode);else if(4!==t.tag&&null!==t.child){t.child.return=t;t=t.child;continue}if(t===n)break;for(;null===t.sibling;){if(null===t.return||t.return===n)return;t=t.return}t.sibling.return=t.return;t=t.sibling}};mo=function(){};ho=function(e,n,t,r){var l=e.memoizedProps;if(l!==r){e=n.stateNode;Cu(Su.current);var a=null;switch(t){case"input":l=J(e,l);r=J(e,r);a=[];break;case"select":l=V({},l,{value:void 0});r=V({},r,{value:void 0});a=[];break;case"textarea":l=ie(e,l);r=ie(e,r);a=[];break;default:"function"!==typeof l.onClick&&"function"===typeof r.onClick&&(e.onclick=wl)}we(t,r);var u;t=null;for(c in l)if(!r.hasOwnProperty(c)&&l.hasOwnProperty(c)&&null!=l[c])if("style"===c){var o=l[c];for(u in o)o.hasOwnProperty(u)&&(t||(t={}),t[u]="")}else"dangerouslySetInnerHTML"!==c&&"children"!==c&&"suppressContentEditableWarning"!==c&&"suppressHydrationWarning"!==c&&"autoFocus"!==c&&(i.hasOwnProperty(c)?a||(a=[]):(a=a||[]).push(c,null));for(c in r){var s=r[c];o=null!=l?l[c]:void 0;if(r.hasOwnProperty(c)&&s!==o&&(null!=s||null!=o))if("style"===c)if(o){for(u in o)!o.hasOwnProperty(u)||s&&s.hasOwnProperty(u)||(t||(t={}),t[u]="");for(u in s)s.hasOwnProperty(u)&&o[u]!==s[u]&&(t||(t={}),t[u]=s[u])}else t||(a||(a=[]),a.push(c,t)),t=s;else"dangerouslySetInnerHTML"===c?(s=s?s.__html:void 0,o=o?o.__html:void 0,null!=s&&o!==s&&(a=a||[]).push(c,s)):"children"===c?"string"!==typeof s&&"number"!==typeof s||(a=a||[]).push(c,""+s):"suppressContentEditableWarning"!==c&&"suppressHydrationWarning"!==c&&(i.hasOwnProperty(c)?(null!=s&&"onScroll"===c&&il("scroll",e),a||o===s||(a=[])):(a=a||[]).push(c,s))}t&&(a=a||[]).push("style",t);var c=a;if(n.updateQueue=c)n.flags|=4}};go=function(e,n,t,r){t!==r&&(n.flags|=4)};function vo(e,n){if(!Na)switch(e.tailMode){case"hidden":n=e.tail;for(var t=null;null!==n;)null!==n.alternate&&(t=n),n=n.sibling;null===t?e.tail=null:t.sibling=null;break;case"collapsed":t=e.tail;for(var r=null;null!==t;)null!==t.alternate&&(r=t),t=t.sibling;null===r?n||null===e.tail?e.tail=null:e.tail.sibling=null:r.sibling=null}}function yo(e){var n=null!==e.alternate&&e.alternate.child===e.child,t=0,r=0;if(n)for(var l=e.child;null!==l;)t|=l.lanes|l.childLanes,r|=l.subtreeFlags&14680064,r|=l.flags&14680064,l.return=e,l=l.sibling;else for(l=e.child;null!==l;)t|=l.lanes|l.childLanes,r|=l.subtreeFlags,r|=l.flags,l.return=e,l=l.sibling;e.subtreeFlags|=r;e.childLanes=t;return n}function bo(e,n,t){var r=n.pendingProps;Ea(n);switch(n.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return yo(n),null;case 1:return ea(n.type)&&na(),yo(n),null;case 3:r=n.stateNode;Nu();Kl(Gl);Kl(Xl);Fu();r.pendingContext&&(r.context=r.pendingContext,r.pendingContext=null);if(null===e||null===e.child)Da(n)?n.flags|=4:null===e||e.memoizedState.isDehydrated&&0===(n.flags&256)||(n.flags|=1024,null!==za&&(Ms(za),za=null));mo(e,n);yo(n);return null;case 5:Pu(n);var l=Cu(Eu.current);t=n.type;if(null!==e&&null!=n.stateNode)ho(e,n,t,r,l),e.ref!==n.ref&&(n.flags|=512,n.flags|=2097152);else{if(!r){if(null===n.stateNode)throw Error(a(166));yo(n);return null}e=Cu(Su.current);if(Da(n)){r=n.stateNode;t=n.type;var u=n.memoizedProps;r[Dl]=n;r[Rl]=u;e=0!==(n.mode&1);switch(t){case"dialog":il("cancel",r);il("close",r);break;case"iframe":case"object":case"embed":il("load",r);break;case"video":case"audio":for(l=0;l<rl.length;l++)il(rl[l],r);break;case"source":il("error",r);break;case"img":case"image":case"link":il("error",r);il("load",r);break;case"details":il("toggle",r);break;case"input":ee(r,u);il("invalid",r);break;case"select":r._wrapperState={wasMultiple:!!u.multiple};il("invalid",r);break;case"textarea":oe(r,u),il("invalid",r)}we(t,u);l=null;for(var o in u)if(u.hasOwnProperty(o)){var s=u[o];"children"===o?"string"===typeof s?r.textContent!==s&&(!0!==u.suppressHydrationWarning&&kl(r.textContent,s,e),l=["children",s]):"number"===typeof s&&r.textContent!==""+s&&(!0!==u.suppressHydrationWarning&&kl(r.textContent,s,e),l=["children",""+s]):i.hasOwnProperty(o)&&null!=s&&"onScroll"===o&&il("scroll",r)}switch(t){case"input":X(r);re(r,u,!0);break;case"textarea":X(r);ce(r);break;case"select":case"option":break;default:"function"===typeof u.onClick&&(r.onclick=wl)}r=l;n.updateQueue=r;null!==r&&(n.flags|=4)}else{o=9===l.nodeType?l:l.ownerDocument;"http://www.w3.org/1999/xhtml"===e&&(e=fe(t));"http://www.w3.org/1999/xhtml"===e?"script"===t?(e=o.createElement("div"),e.innerHTML="<script><\/script>",e=e.removeChild(e.firstChild)):"string"===typeof r.is?e=o.createElement(t,{is:r.is}):(e=o.createElement(t),"select"===t&&(o=e,r.multiple?o.multiple=!0:r.size&&(o.size=r.size))):e=o.createElementNS(e,t);e[Dl]=n;e[Rl]=r;po(e,n,!1,!1);n.stateNode=e;e:{o=Se(t,r);switch(t){case"dialog":il("cancel",e);il("close",e);l=r;break;case"iframe":case"object":case"embed":il("load",e);l=r;break;case"video":case"audio":for(l=0;l<rl.length;l++)il(rl[l],e);l=r;break;case"source":il("error",e);l=r;break;case"img":case"image":case"link":il("error",e);il("load",e);l=r;break;case"details":il("toggle",e);l=r;break;case"input":ee(e,r);l=J(e,r);il("invalid",e);break;case"option":l=r;break;case"select":e._wrapperState={wasMultiple:!!r.multiple};l=V({},r,{value:void 0});il("invalid",e);break;case"textarea":oe(e,r);l=ie(e,r);il("invalid",e);break;default:l=r}we(t,l);s=l;for(u in s)if(s.hasOwnProperty(u)){var c=s[u];"style"===u?be(e,c):"dangerouslySetInnerHTML"===u?(c=c?c.__html:void 0,null!=c&&me(e,c)):"children"===u?"string"===typeof c?("textarea"!==t||""!==c)&&he(e,c):"number"===typeof c&&he(e,""+c):"suppressContentEditableWarning"!==u&&"suppressHydrationWarning"!==u&&"autoFocus"!==u&&(i.hasOwnProperty(u)?null!=c&&"onScroll"===u&&il("scroll",e):null!=c&&S(e,u,c,o))}switch(t){case"input":X(e);re(e,r,!1);break;case"textarea":X(e);ce(e);break;case"option":null!=r.value&&e.setAttribute("value",""+K(r.value));break;case"select":e.multiple=!!r.multiple;u=r.value;null!=u?ue(e,!!r.multiple,u,!1):null!=r.defaultValue&&ue(e,!!r.multiple,r.defaultValue,!0);break;default:"function"===typeof l.onClick&&(e.onclick=wl)}switch(t){case"button":case"input":case"select":case"textarea":r=!!r.autoFocus;break e;case"img":r=!0;break e;default:r=!1}}r&&(n.flags|=4)}null!==n.ref&&(n.flags|=512,n.flags|=2097152)}yo(n);return null;case 6:if(e&&null!=n.stateNode)go(e,n,e.memoizedProps,r);else{if("string"!==typeof r&&null===n.stateNode)throw Error(a(166));t=Cu(Eu.current);Cu(Su.current);if(Da(n)){r=n.stateNode;t=n.memoizedProps;r[Dl]=n;if(u=r.nodeValue!==t)if(e=Ca,null!==e)switch(e.tag){case 3:kl(r.nodeValue,t,0!==(e.mode&1));break;case 5:!0!==e.memoizedProps.suppressHydrationWarning&&kl(r.nodeValue,t,0!==(e.mode&1))}u&&(n.flags|=4)}else r=(9===t.nodeType?t:t.ownerDocument).createTextNode(r),r[Dl]=n,n.stateNode=r}yo(n);return null;case 13:Kl(Tu);r=n.memoizedState;if(null===e||null!==e.memoizedState&&null!==e.memoizedState.dehydrated){if(Na&&null!==_a&&0!==(n.mode&1)&&0===(n.flags&128))Ra(),Oa(),n.flags|=98560,u=!1;else if(u=Da(n),null!==r&&null!==r.dehydrated){if(null===e){if(!u)throw Error(a(318));u=n.memoizedState;u=null!==u?u.dehydrated:null;if(!u)throw Error(a(317));u[Dl]=n}else Oa(),0===(n.flags&128)&&(n.memoizedState=null),n.flags|=4;yo(n);u=!1}else null!==za&&(Ms(za),za=null),u=!0;if(!u)return n.flags&65536?n:null}if(0!==(n.flags&128))return n.lanes=t,n;r=null!==r;r!==(null!==e&&null!==e.memoizedState)&&r&&(n.child.flags|=8192,0!==(n.mode&1)&&(null===e||0!==(Tu.current&1)?0===us&&(us=3):Hs()));null!==n.updateQueue&&(n.flags|=4);yo(n);return null;case 4:return Nu(),mo(e,n),null===e&&cl(n.stateNode.containerInfo),yo(n),null;case 10:return ja(n.type._context),yo(n),null;case 17:return ea(n.type)&&na(),yo(n),null;case 19:Kl(Tu);u=n.memoizedState;if(null===u)return yo(n),null;r=0!==(n.flags&128);o=u.rendering;if(null===o)if(r)vo(u,!1);else{if(0!==us||null!==e&&0!==(e.flags&128))for(e=n.child;null!==e;){o=Lu(e);if(null!==o){n.flags|=128;vo(u,!1);r=o.updateQueue;null!==r&&(n.updateQueue=r,n.flags|=4);n.subtreeFlags=0;r=t;for(t=n.child;null!==t;)u=t,e=r,u.flags&=14680066,o=u.alternate,null===o?(u.childLanes=0,u.lanes=e,u.child=null,u.subtreeFlags=0,u.memoizedProps=null,u.memoizedState=null,u.updateQueue=null,u.dependencies=null,u.stateNode=null):(u.childLanes=o.childLanes,u.lanes=o.lanes,u.child=o.child,u.subtreeFlags=0,u.deletions=null,u.memoizedProps=o.memoizedProps,u.memoizedState=o.memoizedState,u.updateQueue=o.updateQueue,u.type=o.type,e=o.dependencies,u.dependencies=null===e?null:{lanes:e.lanes,firstContext:e.firstContext}),t=t.sibling;ql(Tu,Tu.current&1|2);return n.child}e=e.sibling}null!==u.tail&&tn()>ms&&(n.flags|=128,r=!0,vo(u,!1),n.lanes=4194304)}else{if(!r)if(e=Lu(o),null!==e){if(n.flags|=128,r=!0,t=e.updateQueue,null!==t&&(n.updateQueue=t,n.flags|=4),vo(u,!0),null===u.tail&&"hidden"===u.tailMode&&!o.alternate&&!Na)return yo(n),null}else 2*tn()-u.renderingStartTime>ms&&1073741824!==t&&(n.flags|=128,r=!0,vo(u,!1),n.lanes=4194304);u.isBackwards?(o.sibling=n.child,n.child=o):(t=u.last,null!==t?t.sibling=o:n.child=o,u.last=o)}if(null!==u.tail)return n=u.tail,u.rendering=n,u.tail=n.sibling,u.renderingStartTime=tn(),n.sibling=null,t=Tu.current,ql(Tu,r?t&1|2:t&1),n;yo(n);return null;case 22:case 23:return Us(),r=null!==n.memoizedState,null!==e&&null!==e.memoizedState!==r&&(n.flags|=8192),r&&0!==(n.mode&1)?0!==(ls&1073741824)&&(yo(n),n.subtreeFlags&6&&(n.flags|=8192)):yo(n),null;case 24:return null;case 25:return null}throw Error(a(156,n.tag))}function ko(e,n){Ea(n);switch(n.tag){case 1:return ea(n.type)&&na(),e=n.flags,e&65536?(n.flags=e&-65537|128,n):null;case 3:return Nu(),Kl(Gl),Kl(Xl),Fu(),e=n.flags,0!==(e&65536)&&0===(e&128)?(n.flags=e&-65537|128,n):null;case 5:return Pu(n),null;case 13:Kl(Tu);e=n.memoizedState;if(null!==e&&null!==e.dehydrated){if(null===n.alternate)throw Error(a(340));Oa()}e=n.flags;return e&65536?(n.flags=e&-65537|128,n):null;case 19:return Kl(Tu),null;case 4:return Nu(),null;case 10:return ja(n.type._context),null;case 22:case 23:return Us(),null;case 24:return null;default:return null}}var wo=!1,So=!1,xo="function"===typeof WeakSet?WeakSet:Set,Eo=null;function Co(e,n){var t=e.ref;if(null!==t)if("function"===typeof t)try{t(null)}catch(r){Zs(e,n,r)}else t.current=null}function _o(e,n,t){try{t()}catch(r){Zs(e,n,r)}}var No=!1;function zo(e,n){Sl=nt;e=Mr();if(Fr(e)){if("selectionStart"in e)var t={start:e.selectionStart,end:e.selectionEnd};else e:{t=(t=e.ownerDocument)&&t.defaultView||window;var r=t.getSelection&&t.getSelection();if(r&&0!==r.rangeCount){t=r.anchorNode;var l=r.anchorOffset,u=r.focusNode;r=r.focusOffset;try{t.nodeType,u.nodeType}catch(w){t=null;break e}var i=0,o=-1,s=-1,c=0,f=0,d=e,p=null;n:for(;;){for(var m;;){d!==t||0!==l&&3!==d.nodeType||(o=i+l);d!==u||0!==r&&3!==d.nodeType||(s=i+r);3===d.nodeType&&(i+=d.nodeValue.length);if(null===(m=d.firstChild))break;p=d;d=m}for(;;){if(d===e)break n;p===t&&++c===l&&(o=i);p===u&&++f===r&&(s=i);if(null!==(m=d.nextSibling))break;d=p;p=d.parentNode}d=m}t=-1===o||-1===s?null:{start:o,end:s}}else t=null}t=t||{start:0,end:0}}else t=null;xl={focusedElem:e,selectionRange:t};nt=!1;for(Eo=n;null!==Eo;)if(n=Eo,e=n.child,0!==(n.subtreeFlags&1028)&&null!==e)e.return=n,Eo=e;else for(;null!==Eo;){n=Eo;try{var h=n.alternate;if(0!==(n.flags&1024))switch(n.tag){case 0:case 11:case 15:break;case 1:if(null!==h){var g=h.memoizedProps,v=h.memoizedState,y=n.stateNode,b=y.getSnapshotBeforeUpdate(n.elementType===n.type?g:Va(n.type,g),v);y.__reactInternalSnapshotBeforeUpdate=b}break;case 3:var k=n.stateNode.containerInfo;1===k.nodeType?k.textContent="":9===k.nodeType&&k.documentElement&&k.removeChild(k.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(a(163))}}catch(w){Zs(n,n.return,w)}e=n.sibling;if(null!==e){e.return=n.return;Eo=e;break}Eo=n.return}h=No;No=!1;return h}function Po(e,n,t){var r=n.updateQueue;r=null!==r?r.lastEffect:null;if(null!==r){var l=r=r.next;do{if((l.tag&e)===e){var a=l.destroy;l.destroy=void 0;void 0!==a&&_o(n,t,a)}l=l.next}while(l!==r)}}function To(e,n){n=n.updateQueue;n=null!==n?n.lastEffect:null;if(null!==n){var t=n=n.next;do{if((t.tag&e)===e){var r=t.create;t.destroy=r()}t=t.next}while(t!==n)}}function Lo(e){var n=e.ref;if(null!==n){var t=e.stateNode;switch(e.tag){case 5:e=t;break;default:e=t}"function"===typeof n?n(e):n.current=e}}function Mo(e){var n=e.alternate;null!==n&&(e.alternate=null,Mo(n));e.child=null;e.deletions=null;e.sibling=null;5===e.tag&&(n=e.stateNode,null!==n&&(delete n[Dl],delete n[Rl],delete n[Il],delete n[Ul],delete n[Vl]));e.stateNode=null;e.return=null;e.dependencies=null;e.memoizedProps=null;e.memoizedState=null;e.pendingProps=null;e.stateNode=null;e.updateQueue=null}function Fo(e){return 5===e.tag||3===e.tag||4===e.tag}function Do(e){e:for(;;){for(;null===e.sibling;){if(null===e.return||Fo(e.return))return null;e=e.return}e.sibling.return=e.return;for(e=e.sibling;5!==e.tag&&6!==e.tag&&18!==e.tag;){if(e.flags&2)continue e;if(null===e.child||4===e.tag)continue e;else e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Ro(e,n,t){var r=e.tag;if(5===r||6===r)e=e.stateNode,n?8===t.nodeType?t.parentNode.insertBefore(e,n):t.insertBefore(e,n):(8===t.nodeType?(n=t.parentNode,n.insertBefore(e,t)):(n=t,n.appendChild(e)),t=t._reactRootContainer,null!==t&&void 0!==t||null!==n.onclick||(n.onclick=wl));else if(4!==r&&(e=e.child,null!==e))for(Ro(e,n,t),e=e.sibling;null!==e;)Ro(e,n,t),e=e.sibling}function Oo(e,n,t){var r=e.tag;if(5===r||6===r)e=e.stateNode,n?t.insertBefore(e,n):t.appendChild(e);else if(4!==r&&(e=e.child,null!==e))for(Oo(e,n,t),e=e.sibling;null!==e;)Oo(e,n,t),e=e.sibling}var Io=null,Uo=!1;function Vo(e,n,t){for(t=t.child;null!==t;)Ao(e,n,t),t=t.sibling}function Ao(e,n,t){if(fn&&"function"===typeof fn.onCommitFiberUnmount)try{fn.onCommitFiberUnmount(cn,t)}catch(i){}switch(t.tag){case 5:So||Co(t,n);case 6:var r=Io,l=Uo;Io=null;Vo(e,n,t);Io=r;Uo=l;null!==Io&&(Uo?(e=Io,t=t.stateNode,8===e.nodeType?e.parentNode.removeChild(t):e.removeChild(t)):Io.removeChild(t.stateNode));break;case 18:null!==Io&&(Uo?(e=Io,t=t.stateNode,8===e.nodeType?Tl(e.parentNode,t):1===e.nodeType&&Tl(e,t),Jn(e)):Tl(Io,t.stateNode));break;case 4:r=Io;l=Uo;Io=t.stateNode.containerInfo;Uo=!0;Vo(e,n,t);Io=r;Uo=l;break;case 0:case 11:case 14:case 15:if(!So&&(r=t.updateQueue,null!==r&&(r=r.lastEffect,null!==r))){l=r=r.next;do{var a=l,u=a.destroy;a=a.tag;void 0!==u&&(0!==(a&2)?_o(t,n,u):0!==(a&4)&&_o(t,n,u));l=l.next}while(l!==r)}Vo(e,n,t);break;case 1:if(!So&&(Co(t,n),r=t.stateNode,"function"===typeof r.componentWillUnmount))try{r.props=t.memoizedProps,r.state=t.memoizedState,r.componentWillUnmount()}catch(i){Zs(t,n,i)}Vo(e,n,t);break;case 21:Vo(e,n,t);break;case 22:t.mode&1?(So=(r=So)||null!==t.memoizedState,Vo(e,n,t),So=r):Vo(e,n,t);break;default:Vo(e,n,t)}}function Bo(e){var n=e.updateQueue;if(null!==n){e.updateQueue=null;var t=e.stateNode;null===t&&(t=e.stateNode=new xo);n.forEach((function(n){var r=tc.bind(null,e,n);t.has(n)||(t.add(n),n.then(r,r))}))}}function Ho(e,n){var t=n.deletions;if(null!==t)for(var r=0;r<t.length;r++){var l=t[r];try{var u=e,i=n,o=i;e:for(;null!==o;){switch(o.tag){case 5:Io=o.stateNode;Uo=!1;break e;case 3:Io=o.stateNode.containerInfo;Uo=!0;break e;case 4:Io=o.stateNode.containerInfo;Uo=!0;break e}o=o.return}if(null===Io)throw Error(a(160));Ao(u,i,l);Io=null;Uo=!1;var s=l.alternate;null!==s&&(s.return=null);l.return=null}catch(c){Zs(l,n,c)}}if(n.subtreeFlags&12854)for(n=n.child;null!==n;)Wo(n,e),n=n.sibling}function Wo(e,n){var t=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:Ho(n,e);Qo(e);if(r&4){try{Po(3,e,e.return),To(3,e)}catch(g){Zs(e,e.return,g)}try{Po(5,e,e.return)}catch(g){Zs(e,e.return,g)}}break;case 1:Ho(n,e);Qo(e);r&512&&null!==t&&Co(t,t.return);break;case 5:Ho(n,e);Qo(e);r&512&&null!==t&&Co(t,t.return);if(e.flags&32){var l=e.stateNode;try{he(l,"")}catch(g){Zs(e,e.return,g)}}if(r&4&&(l=e.stateNode,null!=l)){var u=e.memoizedProps,i=null!==t?t.memoizedProps:u,o=e.type,s=e.updateQueue;e.updateQueue=null;if(null!==s)try{"input"===o&&"radio"===u.type&&null!=u.name&&ne(l,u);Se(o,i);var c=Se(o,u);for(i=0;i<s.length;i+=2){var f=s[i],d=s[i+1];"style"===f?be(l,d):"dangerouslySetInnerHTML"===f?me(l,d):"children"===f?he(l,d):S(l,f,d,c)}switch(o){case"input":te(l,u);break;case"textarea":se(l,u);break;case"select":var p=l._wrapperState.wasMultiple;l._wrapperState.wasMultiple=!!u.multiple;var m=u.value;null!=m?ue(l,!!u.multiple,m,!1):p!==!!u.multiple&&(null!=u.defaultValue?ue(l,!!u.multiple,u.defaultValue,!0):ue(l,!!u.multiple,u.multiple?[]:"",!1))}l[Rl]=u}catch(g){Zs(e,e.return,g)}}break;case 6:Ho(n,e);Qo(e);if(r&4){if(null===e.stateNode)throw Error(a(162));l=e.stateNode;u=e.memoizedProps;try{l.nodeValue=u}catch(g){Zs(e,e.return,g)}}break;case 3:Ho(n,e);Qo(e);if(r&4&&null!==t&&t.memoizedState.isDehydrated)try{Jn(n.containerInfo)}catch(g){Zs(e,e.return,g)}break;case 4:Ho(n,e);Qo(e);break;case 13:Ho(n,e);Qo(e);l=e.child;l.flags&8192&&(u=null!==l.memoizedState,l.stateNode.isHidden=u,!u||null!==l.alternate&&null!==l.alternate.memoizedState||(ps=tn()));r&4&&Bo(e);break;case 22:f=null!==t&&null!==t.memoizedState;e.mode&1?(So=(c=So)||f,Ho(n,e),So=c):Ho(n,e);Qo(e);if(r&8192){c=null!==e.memoizedState;if((e.stateNode.isHidden=c)&&!f&&0!==(e.mode&1))for(Eo=e,f=e.child;null!==f;){for(d=Eo=f;null!==Eo;){p=Eo;m=p.child;switch(p.tag){case 0:case 11:case 14:case 15:Po(4,p,p.return);break;case 1:Co(p,p.return);var h=p.stateNode;if("function"===typeof h.componentWillUnmount){r=p;t=p.return;try{n=r,h.props=n.memoizedProps,h.state=n.memoizedState,h.componentWillUnmount()}catch(g){Zs(r,t,g)}}break;case 5:Co(p,p.return);break;case 22:if(null!==p.memoizedState){qo(d);continue}}null!==m?(m.return=p,Eo=m):qo(d)}f=f.sibling}e:for(f=null,d=e;;){if(5===d.tag){if(null===f){f=d;try{l=d.stateNode,c?(u=l.style,"function"===typeof u.setProperty?u.setProperty("display","none","important"):u.display="none"):(o=d.stateNode,s=d.memoizedProps.style,i=void 0!==s&&null!==s&&s.hasOwnProperty("display")?s.display:null,o.style.display=ye("display",i))}catch(g){Zs(e,e.return,g)}}}else if(6===d.tag){if(null===f)try{d.stateNode.nodeValue=c?"":d.memoizedProps}catch(g){Zs(e,e.return,g)}}else if((22!==d.tag&&23!==d.tag||null===d.memoizedState||d===e)&&null!==d.child){d.child.return=d;d=d.child;continue}if(d===e)break e;for(;null===d.sibling;){if(null===d.return||d.return===e)break e;f===d&&(f=null);d=d.return}f===d&&(f=null);d.sibling.return=d.return;d=d.sibling}}break;case 19:Ho(n,e);Qo(e);r&4&&Bo(e);break;case 21:break;default:Ho(n,e),Qo(e)}}function Qo(e){var n=e.flags;if(n&2){try{e:{for(var t=e.return;null!==t;){if(Fo(t)){var r=t;break e}t=t.return}throw Error(a(160))}switch(r.tag){case 5:var l=r.stateNode;r.flags&32&&(he(l,""),r.flags&=-33);var u=Do(e);Oo(e,u,l);break;case 3:case 4:var i=r.stateNode.containerInfo,o=Do(e);Ro(e,o,i);break;default:throw Error(a(161))}}catch(s){Zs(e,e.return,s)}e.flags&=-3}n&4096&&(e.flags&=-4097)}function jo(e,n,t){Eo=e;$o(e,n,t)}function $o(e,n,t){for(var r=0!==(e.mode&1);null!==Eo;){var l=Eo,a=l.child;if(22===l.tag&&r){var u=null!==l.memoizedState||wo;if(!u){var i=l.alternate,o=null!==i&&null!==i.memoizedState||So;i=wo;var s=So;wo=u;if((So=o)&&!s)for(Eo=l;null!==Eo;)u=Eo,o=u.child,22===u.tag&&null!==u.memoizedState?Yo(l):null!==o?(o.return=u,Eo=o):Yo(l);for(;null!==a;)Eo=a,$o(a,n,t),a=a.sibling;Eo=l;wo=i;So=s}Ko(e,n,t)}else 0!==(l.subtreeFlags&8772)&&null!==a?(a.return=l,Eo=a):Ko(e,n,t)}}function Ko(e){for(;null!==Eo;){var n=Eo;if(0!==(n.flags&8772)){var t=n.alternate;try{if(0!==(n.flags&8772))switch(n.tag){case 0:case 11:case 15:So||To(5,n);break;case 1:var r=n.stateNode;if(n.flags&4&&!So)if(null===t)r.componentDidMount();else{var l=n.elementType===n.type?t.memoizedProps:Va(n.type,t.memoizedProps);r.componentDidUpdate(l,t.memoizedState,r.__reactInternalSnapshotBeforeUpdate)}var u=n.updateQueue;null!==u&&iu(n,u,r);break;case 3:var i=n.updateQueue;if(null!==i){t=null;if(null!==n.child)switch(n.child.tag){case 5:t=n.child.stateNode;break;case 1:t=n.child.stateNode}iu(n,i,t)}break;case 5:var o=n.stateNode;if(null===t&&n.flags&4){t=o;var s=n.memoizedProps;switch(n.type){case"button":case"input":case"select":case"textarea":s.autoFocus&&t.focus();break;case"img":s.src&&(t.src=s.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(null===n.memoizedState){var c=n.alternate;if(null!==c){var f=c.memoizedState;if(null!==f){var d=f.dehydrated;null!==d&&Jn(d)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(a(163))}So||n.flags&512&&Lo(n)}catch(p){Zs(n,n.return,p)}}if(n===e){Eo=null;break}t=n.sibling;if(null!==t){t.return=n.return;Eo=t;break}Eo=n.return}}function qo(e){for(;null!==Eo;){var n=Eo;if(n===e){Eo=null;break}var t=n.sibling;if(null!==t){t.return=n.return;Eo=t;break}Eo=n.return}}function Yo(e){for(;null!==Eo;){var n=Eo;try{switch(n.tag){case 0:case 11:case 15:var t=n.return;try{To(4,n)}catch(o){Zs(n,t,o)}break;case 1:var r=n.stateNode;if("function"===typeof r.componentDidMount){var l=n.return;try{r.componentDidMount()}catch(o){Zs(n,l,o)}}var a=n.return;try{Lo(n)}catch(o){Zs(n,a,o)}break;case 5:var u=n.return;try{Lo(n)}catch(o){Zs(n,u,o)}}}catch(o){Zs(n,n.return,o)}if(n===e){Eo=null;break}var i=n.sibling;if(null!==i){i.return=n.return;Eo=i;break}Eo=n.return}}var Xo=Math.ceil,Go=x.ReactCurrentDispatcher,Zo=x.ReactCurrentOwner,Jo=x.ReactCurrentBatchConfig,es=0,ns=null,ts=null,rs=0,ls=0,as=$l(0),us=0,is=null,os=0,ss=0,cs=0,fs=null,ds=null,ps=0,ms=Infinity,hs=null,gs=!1,vs=null,ys=null,bs=!1,ks=null,ws=0,Ss=0,xs=null,Es=-1,Cs=0;function _s(){return 0!==(es&6)?tn():-1!==Es?Es:Es=tn()}function Ns(e){if(0===(e.mode&1))return 1;if(0!==(es&2)&&0!==rs)return rs&-rs;if(null!==Ua.transition)return 0===Cs&&(Cs=En()),Cs;e=Pn;if(0!==e)return e;e=window.event;e=void 0===e?16:it(e.type);return e}function zs(e,n,t,r){if(50<Ss)throw Ss=0,xs=null,Error(a(185));_n(e,t,r);if(0===(es&2)||e!==ns)e===ns&&(0===(es&2)&&(ss|=t),4===us&&Ds(e,rs)),Ps(e,r),1===t&&0===es&&0===(n.mode&1)&&(ms=tn()+500,ia&&fa())}function Ps(e,n){var t=e.callbackNode;Sn(e,n);var r=kn(e,e===ns?rs:0);if(0===r)null!==t&&Je(t),e.callbackNode=null,e.callbackPriority=0;else if(n=r&-r,e.callbackPriority!==n){null!=t&&Je(t);if(1===n)0===e.tag?ca(Rs.bind(null,e)):sa(Rs.bind(null,e)),zl((function(){0===(es&6)&&fa()})),t=null;else{switch(Tn(r)){case 1:t=ln;break;case 4:t=an;break;case 16:t=un;break;case 536870912:t=sn;break;default:t=un}t=lc(t,Ts.bind(null,e))}e.callbackPriority=n;e.callbackNode=t}}function Ts(e,n){Es=-1;Cs=0;if(0!==(es&6))throw Error(a(327));var t=e.callbackNode;if(Xs()&&e.callbackNode!==t)return null;var r=kn(e,e===ns?rs:0);if(0===r)return null;if(0!==(r&30)||0!==(r&e.expiredLanes)||n)n=Ws(e,r);else{n=r;var l=es;es|=2;var u=Bs();if(ns!==e||rs!==n)hs=null,ms=tn()+500,Vs(e,n);do{try{js();break}catch(o){As(e,o)}}while(1);Qa();Go.current=u;es=l;null!==ts?n=0:(ns=null,rs=0,n=us)}if(0!==n){2===n&&(l=xn(e),0!==l&&(r=l,n=Ls(e,l)));if(1===n)throw t=is,Vs(e,0),Ds(e,r),Ps(e,tn()),t;if(6===n)Ds(e,r);else{l=e.current.alternate;if(0===(r&30)&&!Fs(l)&&(n=Ws(e,r),2===n&&(u=xn(e),0!==u&&(r=u,n=Ls(e,u))),1===n))throw t=is,Vs(e,0),Ds(e,r),Ps(e,tn()),t;e.finishedWork=l;e.finishedLanes=r;switch(n){case 0:case 1:throw Error(a(345));case 2:qs(e,ds,hs);break;case 3:Ds(e,r);if((r&130023424)===r&&(n=ps+500-tn(),10<n)){if(0!==kn(e,0))break;l=e.suspendedLanes;if((l&r)!==r){_s();e.pingedLanes|=e.suspendedLanes&l;break}e.timeoutHandle=Cl(qs.bind(null,e,ds,hs),n);break}qs(e,ds,hs);break;case 4:Ds(e,r);if((r&4194240)===r)break;n=e.eventTimes;for(l=-1;0<r;){var i=31-pn(r);u=1<<i;i=n[i];i>l&&(l=i);r&=~u}r=l;r=tn()-r;r=(120>r?120:480>r?480:1080>r?1080:1920>r?1920:3e3>r?3e3:4320>r?4320:1960*Xo(r/1960))-r;if(10<r){e.timeoutHandle=Cl(qs.bind(null,e,ds,hs),r);break}qs(e,ds,hs);break;case 5:qs(e,ds,hs);break;default:throw Error(a(329))}}}Ps(e,tn());return e.callbackNode===t?Ts.bind(null,e):null}function Ls(e,n){var t=fs;e.current.memoizedState.isDehydrated&&(Vs(e,n).flags|=256);e=Ws(e,n);2!==e&&(n=ds,ds=t,null!==n&&Ms(n));return e}function Ms(e){null===ds?ds=e:ds.push.apply(ds,e)}function Fs(e){for(var n=e;;){if(n.flags&16384){var t=n.updateQueue;if(null!==t&&(t=t.stores,null!==t))for(var r=0;r<t.length;r++){var l=t[r],a=l.getSnapshot;l=l.value;try{if(!Nr(a(),l))return!1}catch(u){return!1}}}t=n.child;if(n.subtreeFlags&16384&&null!==t)t.return=n,n=t;else{if(n===e)break;for(;null===n.sibling;){if(null===n.return||n.return===e)return!0;n=n.return}n.sibling.return=n.return;n=n.sibling}}return!0}function Ds(e,n){n&=~cs;n&=~ss;e.suspendedLanes|=n;e.pingedLanes&=~n;for(e=e.expirationTimes;0<n;){var t=31-pn(n),r=1<<t;e[t]=-1;n&=~r}}function Rs(e){if(0!==(es&6))throw Error(a(327));Xs();var n=kn(e,0);if(0===(n&1))return Ps(e,tn()),null;var t=Ws(e,n);if(0!==e.tag&&2===t){var r=xn(e);0!==r&&(n=r,t=Ls(e,r))}if(1===t)throw t=is,Vs(e,0),Ds(e,n),Ps(e,tn()),t;if(6===t)throw Error(a(345));e.finishedWork=e.current.alternate;e.finishedLanes=n;qs(e,ds,hs);Ps(e,tn());return null}function Os(e,n){var t=es;es|=1;try{return e(n)}finally{es=t,0===es&&(ms=tn()+500,ia&&fa())}}function Is(e){null!==ks&&0===ks.tag&&0===(es&6)&&Xs();var n=es;es|=1;var t=Jo.transition,r=Pn;try{if(Jo.transition=null,Pn=1,e)return e()}finally{Pn=r,Jo.transition=t,es=n,0===(es&6)&&fa()}}function Us(){ls=as.current;Kl(as)}function Vs(e,n){e.finishedWork=null;e.finishedLanes=0;var t=e.timeoutHandle;-1!==t&&(e.timeoutHandle=-1,_l(t));if(null!==ts)for(t=ts.return;null!==t;){var r=t;Ea(r);switch(r.tag){case 1:r=r.type.childContextTypes;null!==r&&void 0!==r&&na();break;case 3:Nu();Kl(Gl);Kl(Xl);Fu();break;case 5:Pu(r);break;case 4:Nu();break;case 13:Kl(Tu);break;case 19:Kl(Tu);break;case 10:ja(r.type._context);break;case 22:case 23:Us()}t=t.return}ns=e;ts=e=sc(e.current,null);rs=ls=n;us=0;is=null;cs=ss=os=0;ds=fs=null;if(null!==Ya){for(n=0;n<Ya.length;n++)if(t=Ya[n],r=t.interleaved,null!==r){t.interleaved=null;var l=r.next,a=t.pending;if(null!==a){var u=a.next;a.next=l;r.next=u}t.pending=r}Ya=null}return e}function As(e,n){do{var t=ts;try{Qa();Du.current=zi;if(Au){for(var r=Iu.memoizedState;null!==r;){var l=r.queue;null!==l&&(l.pending=null);r=r.next}Au=!1}Ou=0;Vu=Uu=Iu=null;Bu=!1;Hu=0;Zo.current=null;if(null===t||null===t.return){us=1;is=n;ts=null;break}e:{var u=e,i=t.return,o=t,s=n;n=rs;o.flags|=32768;if(null!==s&&"object"===typeof s&&"function"===typeof s.then){var c=s,f=o,d=f.tag;if(0===(f.mode&1)&&(0===d||11===d||15===d)){var p=f.alternate;p?(f.updateQueue=p.updateQueue,f.memoizedState=p.memoizedState,f.lanes=p.lanes):(f.updateQueue=null,f.memoizedState=null)}var m=Vi(i);if(null!==m){m.flags&=-257;Ai(m,i,o,u,n);m.mode&1&&Ui(u,c,n);n=m;s=c;var h=n.updateQueue;if(null===h){var g=new Set;g.add(s);n.updateQueue=g}else h.add(s);break e}else{if(0===(n&1)){Ui(u,c,n);Hs();break e}s=Error(a(426))}}else if(Na&&o.mode&1){var v=Vi(i);if(null!==v){0===(v.flags&65536)&&(v.flags|=256);Ai(v,i,o,u,n);Ia(Mi(s,o));break e}}u=s=Mi(s,o);4!==us&&(us=2);null===fs?fs=[u]:fs.push(u);u=i;do{switch(u.tag){case 3:u.flags|=65536;n&=-n;u.lanes|=n;var y=Oi(u,s,n);au(u,y);break e;case 1:o=s;var b=u.type,k=u.stateNode;if(0===(u.flags&128)&&("function"===typeof b.getDerivedStateFromError||null!==k&&"function"===typeof k.componentDidCatch&&(null===ys||!ys.has(k)))){u.flags|=65536;n&=-n;u.lanes|=n;var w=Ii(u,o,n);au(u,w);break e}}u=u.return}while(null!==u)}Ks(t)}catch(S){n=S;ts===t&&null!==t&&(ts=t=t.return);continue}break}while(1)}function Bs(){var e=Go.current;Go.current=zi;return null===e?zi:e}function Hs(){if(0===us||3===us||2===us)us=4;null===ns||0===(os&268435455)&&0===(ss&268435455)||Ds(ns,rs)}function Ws(e,n){var t=es;es|=2;var r=Bs();if(ns!==e||rs!==n)hs=null,Vs(e,n);do{try{Qs();break}catch(l){As(e,l)}}while(1);Qa();es=t;Go.current=r;if(null!==ts)throw Error(a(261));ns=null;rs=0;return us}function Qs(){for(;null!==ts;)$s(ts)}function js(){for(;null!==ts&&!en();)$s(ts)}function $s(e){var n=rc(e.alternate,e,ls);e.memoizedProps=e.pendingProps;null===n?Ks(e):ts=n;Zo.current=null}function Ks(e){var n=e;do{var t=n.alternate;e=n.return;if(0===(n.flags&32768)){if(t=bo(t,n,ls),null!==t){ts=t;return}}else{t=ko(t,n);if(null!==t){t.flags&=32767;ts=t;return}if(null!==e)e.flags|=32768,e.subtreeFlags=0,e.deletions=null;else{us=6;ts=null;return}}n=n.sibling;if(null!==n){ts=n;return}ts=n=e}while(null!==n);0===us&&(us=5)}function qs(e,n,t){var r=Pn,l=Jo.transition;try{Jo.transition=null,Pn=1,Ys(e,n,t,r)}finally{Jo.transition=l,Pn=r}return null}function Ys(e,n,t,r){do{Xs()}while(null!==ks);if(0!==(es&6))throw Error(a(327));t=e.finishedWork;var l=e.finishedLanes;if(null===t)return null;e.finishedWork=null;e.finishedLanes=0;if(t===e.current)throw Error(a(177));e.callbackNode=null;e.callbackPriority=0;var u=t.lanes|t.childLanes;Nn(e,u);e===ns&&(ts=ns=null,rs=0);0===(t.subtreeFlags&2064)&&0===(t.flags&2064)||bs||(bs=!0,lc(un,(function(){Xs();return null})));u=0!==(t.flags&15990);if(0!==(t.subtreeFlags&15990)||u){u=Jo.transition;Jo.transition=null;var i=Pn;Pn=1;var o=es;es|=4;Zo.current=null;zo(e,t);Wo(t,e);Dr(xl);nt=!!Sl;xl=Sl=null;e.current=t;jo(t,e,l);nn();es=o;Pn=i;Jo.transition=u}else e.current=t;bs&&(bs=!1,ks=e,ws=l);u=e.pendingLanes;0===u&&(ys=null);dn(t.stateNode,r);Ps(e,tn());if(null!==n)for(r=e.onRecoverableError,t=0;t<n.length;t++)l=n[t],r(l.value,{componentStack:l.stack,digest:l.digest});if(gs)throw gs=!1,e=vs,vs=null,e;0!==(ws&1)&&0!==e.tag&&Xs();u=e.pendingLanes;0!==(u&1)?e===xs?Ss++:(Ss=0,xs=e):Ss=0;fa();return null}function Xs(){if(null!==ks){var e=Tn(ws),n=Jo.transition,t=Pn;try{Jo.transition=null;Pn=16>e?16:e;if(null===ks)var r=!1;else{e=ks;ks=null;ws=0;if(0!==(es&6))throw Error(a(331));var l=es;es|=4;for(Eo=e.current;null!==Eo;){var u=Eo,i=u.child;if(0!==(Eo.flags&16)){var o=u.deletions;if(null!==o){for(var s=0;s<o.length;s++){var c=o[s];for(Eo=c;null!==Eo;){var f=Eo;switch(f.tag){case 0:case 11:case 15:Po(8,f,u)}var d=f.child;if(null!==d)d.return=f,Eo=d;else for(;null!==Eo;){f=Eo;var p=f.sibling,m=f.return;Mo(f);if(f===c){Eo=null;break}if(null!==p){p.return=m;Eo=p;break}Eo=m}}}var h=u.alternate;if(null!==h){var g=h.child;if(null!==g){h.child=null;do{var v=g.sibling;g.sibling=null;g=v}while(null!==g)}}Eo=u}}if(0!==(u.subtreeFlags&2064)&&null!==i)i.return=u,Eo=i;else e:for(;null!==Eo;){u=Eo;if(0!==(u.flags&2048))switch(u.tag){case 0:case 11:case 15:Po(9,u,u.return)}var y=u.sibling;if(null!==y){y.return=u.return;Eo=y;break e}Eo=u.return}}var b=e.current;for(Eo=b;null!==Eo;){i=Eo;var k=i.child;if(0!==(i.subtreeFlags&2064)&&null!==k)k.return=i,Eo=k;else e:for(i=b;null!==Eo;){o=Eo;if(0!==(o.flags&2048))try{switch(o.tag){case 0:case 11:case 15:To(9,o)}}catch(S){Zs(o,o.return,S)}if(o===i){Eo=null;break e}var w=o.sibling;if(null!==w){w.return=o.return;Eo=w;break e}Eo=o.return}}es=l;fa();if(fn&&"function"===typeof fn.onPostCommitFiberRoot)try{fn.onPostCommitFiberRoot(cn,e)}catch(S){}r=!0}return r}finally{Pn=t,Jo.transition=n}}return!1}function Gs(e,n,t){n=Mi(t,n);n=Oi(e,n,1);e=ru(e,n,1);n=_s();null!==e&&(_n(e,1,n),Ps(e,n))}function Zs(e,n,t){if(3===e.tag)Gs(e,e,t);else for(;null!==n;){if(3===n.tag){Gs(n,e,t);break}else if(1===n.tag){var r=n.stateNode;if("function"===typeof n.type.getDerivedStateFromError||"function"===typeof r.componentDidCatch&&(null===ys||!ys.has(r))){e=Mi(t,e);e=Ii(n,e,1);n=ru(n,e,1);e=_s();null!==n&&(_n(n,1,e),Ps(n,e));break}}n=n.return}}function Js(e,n,t){var r=e.pingCache;null!==r&&r.delete(n);n=_s();e.pingedLanes|=e.suspendedLanes&t;ns===e&&(rs&t)===t&&(4===us||3===us&&(rs&130023424)===rs&&500>tn()-ps?Vs(e,0):cs|=t);Ps(e,n)}function ec(e,n){0===n&&(0===(e.mode&1)?n=1:(n=yn,yn<<=1,0===(yn&130023424)&&(yn=4194304)));var t=_s();e=Za(e,n);null!==e&&(_n(e,n,t),Ps(e,t))}function nc(e){var n=e.memoizedState,t=0;null!==n&&(t=n.retryLane);ec(e,t)}function tc(e,n){var t=0;switch(e.tag){case 13:var r=e.stateNode;var l=e.memoizedState;null!==l&&(t=l.retryLane);break;case 19:r=e.stateNode;break;default:throw Error(a(314))}null!==r&&r.delete(n);ec(e,t)}var rc;rc=function(e,n,t){if(null!==e)if(e.memoizedProps!==n.pendingProps||Gl.current)Hi=!0;else{if(0===(e.lanes&t)&&0===(n.flags&128))return Hi=!1,fo(e,n,t);Hi=0!==(e.flags&131072)?!0:!1}else Hi=!1,Na&&0!==(n.flags&1048576)&&Sa(n,ha,n.index);n.lanes=0;switch(n.tag){case 2:var r=n.type;so(e,n);e=n.pendingProps;var l=Jl(n,Xl.current);Ka(n,t);l=$u(null,n,r,e,l,t);var u=Ku();n.flags|=1;"object"===typeof l&&null!==l&&"function"===typeof l.render&&void 0===l.$$typeof?(n.tag=1,n.memoizedState=null,n.updateQueue=null,ea(r)?(u=!0,la(n)):u=!1,n.memoizedState=null!==l.state&&void 0!==l.state?l.state:null,eu(n),l.updater=cu,n.stateNode=l,l._reactInternals=n,mu(n,r,e,t),n=Gi(null,n,r,!0,u,t)):(n.tag=0,Na&&u&&xa(n),Wi(null,n,l,t),n=n.child);return n;case 16:r=n.elementType;e:{so(e,n);e=n.pendingProps;l=r._init;r=l(r._payload);n.type=r;l=n.tag=oc(r);e=Va(r,e);switch(l){case 0:n=Yi(null,n,r,e,t);break e;case 1:n=Xi(null,n,r,e,t);break e;case 11:n=Qi(null,n,r,e,t);break e;case 14:n=ji(null,n,r,Va(r.type,e),t);break e}throw Error(a(306,r,""))}return n;case 0:return r=n.type,l=n.pendingProps,l=n.elementType===r?l:Va(r,l),Yi(e,n,r,l,t);case 1:return r=n.type,l=n.pendingProps,l=n.elementType===r?l:Va(r,l),Xi(e,n,r,l,t);case 3:e:{Zi(n);if(null===e)throw Error(a(387));r=n.pendingProps;u=n.memoizedState;l=u.element;nu(e,n);uu(n,r,null,t);var i=n.memoizedState;r=i.element;if(u.isDehydrated)if(u={element:r,isDehydrated:!1,cache:i.cache,pendingSuspenseBoundaries:i.pendingSuspenseBoundaries,transitions:i.transitions},n.updateQueue.baseState=u,n.memoizedState=u,n.flags&256){l=Mi(Error(a(423)),n);n=Ji(e,n,r,t,l);break e}else if(r!==l){l=Mi(Error(a(424)),n);n=Ji(e,n,r,t,l);break e}else for(_a=Ll(n.stateNode.containerInfo.firstChild),Ca=n,Na=!0,za=null,t=ku(n,null,r,t),n.child=t;t;)t.flags=t.flags&-3|4096,t=t.sibling;else{Oa();if(r===l){n=co(e,n,t);break e}Wi(e,n,r,t)}n=n.child}return n;case 5:return zu(n),null===e&&Ma(n),r=n.type,l=n.pendingProps,u=null!==e?e.memoizedProps:null,i=l.children,El(r,l)?i=null:null!==u&&El(r,u)&&(n.flags|=32),qi(e,n),Wi(e,n,i,t),n.child;case 6:return null===e&&Ma(n),null;case 13:return to(e,n,t);case 4:return _u(n,n.stateNode.containerInfo),r=n.pendingProps,null===e?n.child=bu(n,null,r,t):Wi(e,n,r,t),n.child;case 11:return r=n.type,l=n.pendingProps,l=n.elementType===r?l:Va(r,l),Qi(e,n,r,l,t);case 7:return Wi(e,n,n.pendingProps,t),n.child;case 8:return Wi(e,n,n.pendingProps.children,t),n.child;case 12:return Wi(e,n,n.pendingProps.children,t),n.child;case 10:e:{r=n.type._context;l=n.pendingProps;u=n.memoizedProps;i=l.value;ql(Aa,r._currentValue);r._currentValue=i;if(null!==u)if(Nr(u.value,i)){if(u.children===l.children&&!Gl.current){n=co(e,n,t);break e}}else for(u=n.child,null!==u&&(u.return=n);null!==u;){var o=u.dependencies;if(null!==o){i=u.child;for(var s=o.firstContext;null!==s;){if(s.context===r){if(1===u.tag){s=tu(-1,t&-t);s.tag=2;var c=u.updateQueue;if(null!==c){c=c.shared;var f=c.pending;null===f?s.next=s:(s.next=f.next,f.next=s);c.pending=s}}u.lanes|=t;s=u.alternate;null!==s&&(s.lanes|=t);$a(u.return,t,n);o.lanes|=t;break}s=s.next}}else if(10===u.tag)i=u.type===n.type?null:u.child;else if(18===u.tag){i=u.return;if(null===i)throw Error(a(341));i.lanes|=t;o=i.alternate;null!==o&&(o.lanes|=t);$a(i,t,n);i=u.sibling}else i=u.child;if(null!==i)i.return=u;else for(i=u;null!==i;){if(i===n){i=null;break}u=i.sibling;if(null!==u){u.return=i.return;i=u;break}i=i.return}u=i}Wi(e,n,l.children,t);n=n.child}return n;case 9:return l=n.type,r=n.pendingProps.children,Ka(n,t),l=qa(l),r=r(l),n.flags|=1,Wi(e,n,r,t),n.child;case 14:return r=n.type,l=Va(r,n.pendingProps),l=Va(r.type,l),ji(e,n,r,l,t);case 15:return $i(e,n,n.type,n.pendingProps,t);case 17:return r=n.type,l=n.pendingProps,l=n.elementType===r?l:Va(r,l),so(e,n),n.tag=1,ea(r)?(e=!0,la(n)):e=!1,Ka(n,t),du(n,r,l),mu(n,r,l,t),Gi(null,n,r,!0,e,t);case 19:return oo(e,n,t);case 22:return Ki(e,n,t)}throw Error(a(156,n.tag))};function lc(e,n){return Ze(e,n)}function ac(e,n,t,r){this.tag=e;this.key=t;this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null;this.index=0;this.ref=null;this.pendingProps=n;this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null;this.mode=r;this.subtreeFlags=this.flags=0;this.deletions=null;this.childLanes=this.lanes=0;this.alternate=null}function uc(e,n,t,r){return new ac(e,n,t,r)}function ic(e){e=e.prototype;return!(!e||!e.isReactComponent)}function oc(e){if("function"===typeof e)return ic(e)?1:0;if(void 0!==e&&null!==e){e=e.$$typeof;if(e===L)return 11;if(e===D)return 14}return 2}function sc(e,n){var t=e.alternate;null===t?(t=uc(e.tag,n,e.key,e.mode),t.elementType=e.elementType,t.type=e.type,t.stateNode=e.stateNode,t.alternate=e,e.alternate=t):(t.pendingProps=n,t.type=e.type,t.flags=0,t.subtreeFlags=0,t.deletions=null);t.flags=e.flags&14680064;t.childLanes=e.childLanes;t.lanes=e.lanes;t.child=e.child;t.memoizedProps=e.memoizedProps;t.memoizedState=e.memoizedState;t.updateQueue=e.updateQueue;n=e.dependencies;t.dependencies=null===n?null:{lanes:n.lanes,firstContext:n.firstContext};t.sibling=e.sibling;t.index=e.index;t.ref=e.ref;return t}function cc(e,n,t,r,l,u){var i=2;r=e;if("function"===typeof e)ic(e)&&(i=1);else if("string"===typeof e)i=5;else e:switch(e){case _:return fc(t.children,l,u,n);case N:i=8;l|=8;break;case z:return e=uc(12,t,n,l|2),e.elementType=z,e.lanes=u,e;case M:return e=uc(13,t,n,l),e.elementType=M,e.lanes=u,e;case F:return e=uc(19,t,n,l),e.elementType=F,e.lanes=u,e;case O:return dc(t,l,u,n);default:if("object"===typeof e&&null!==e)switch(e.$$typeof){case P:i=10;break e;case T:i=9;break e;case L:i=11;break e;case D:i=14;break e;case R:i=16;r=null;break e}throw Error(a(130,null==e?e:typeof e,""))}n=uc(i,t,n,l);n.elementType=e;n.type=r;n.lanes=u;return n}function fc(e,n,t,r){e=uc(7,e,r,n);e.lanes=t;return e}function dc(e,n,t,r){e=uc(22,e,r,n);e.elementType=O;e.lanes=t;e.stateNode={isHidden:!1};return e}function pc(e,n,t){e=uc(6,e,null,n);e.lanes=t;return e}function mc(e,n,t){n=uc(4,null!==e.children?e.children:[],e.key,n);n.lanes=t;n.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation};return n}function hc(e,n,t,r,l){this.tag=n;this.containerInfo=e;this.finishedWork=this.pingCache=this.current=this.pendingChildren=null;this.timeoutHandle=-1;this.callbackNode=this.pendingContext=this.context=null;this.callbackPriority=0;this.eventTimes=Cn(0);this.expirationTimes=Cn(-1);this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0;this.entanglements=Cn(0);this.identifierPrefix=r;this.onRecoverableError=l;this.mutableSourceEagerHydrationData=null}function gc(e,n,t,r,l,a,u,i,o){e=new hc(e,n,t,i,o);1===n?(n=1,!0===a&&(n|=8)):n=0;a=uc(3,null,null,n);e.current=a;a.stateNode=e;a.memoizedState={element:r,isDehydrated:t,cache:null,transitions:null,pendingSuspenseBoundaries:null};eu(a);return e}function vc(e,n,t){var r=3<arguments.length&&void 0!==arguments[3]?arguments[3]:null;return{$$typeof:C,key:null==r?null:""+r,children:e,containerInfo:n,implementation:t}}function yc(e){if(!e)return Yl;e=e._reactInternals;e:{if($e(e)!==e||1!==e.tag)throw Error(a(170));var n=e;do{switch(n.tag){case 3:n=n.stateNode.context;break e;case 1:if(ea(n.type)){n=n.stateNode.__reactInternalMemoizedMergedChildContext;break e}}n=n.return}while(null!==n);throw Error(a(171))}if(1===e.tag){var t=e.type;if(ea(t))return ra(e,t,n)}return n}function bc(e,n,t,r,l,a,u,i,o){e=gc(t,r,!0,e,l,a,u,i,o);e.context=yc(null);t=e.current;r=_s();l=Ns(t);a=tu(r,l);a.callback=void 0!==n&&null!==n?n:null;ru(t,a,l);e.current.lanes=l;_n(e,l,r);Ps(e,r);return e}function kc(e,n,t,r){var l=n.current,a=_s(),u=Ns(l);t=yc(t);null===n.context?n.context=t:n.pendingContext=t;n=tu(a,u);n.payload={element:e};r=void 0===r?null:r;null!==r&&(n.callback=r);e=ru(l,n,u);null!==e&&(zs(e,l,u,a),lu(e,l,u));return u}function wc(e){e=e.current;if(!e.child)return null;switch(e.child.tag){case 5:return e.child.stateNode;default:return e.child.stateNode}}function Sc(e,n){e=e.memoizedState;if(null!==e&&null!==e.dehydrated){var t=e.retryLane;e.retryLane=0!==t&&t<n?t:n}}function xc(e,n){Sc(e,n);(e=e.alternate)&&Sc(e,n)}function Ec(){return null}var Cc="function"===typeof reportError?reportError:function(e){console.error(e)};function _c(e){this._internalRoot=e}Nc.prototype.render=_c.prototype.render=function(e){var n=this._internalRoot;if(null===n)throw Error(a(409));kc(e,n,null,null)};Nc.prototype.unmount=_c.prototype.unmount=function(){var e=this._internalRoot;if(null!==e){this._internalRoot=null;var n=e.containerInfo;Is((function(){kc(null,e,null,null)}));n[Ol]=null}};function Nc(e){this._internalRoot=e}Nc.prototype.unstable_scheduleHydration=function(e){if(e){var n=Dn();e={blockedOn:null,target:e,priority:n};for(var t=0;t<Wn.length&&0!==n&&n<Wn[t].priority;t++);Wn.splice(t,0,e);0===t&&qn(e)}};function zc(e){return!(!e||1!==e.nodeType&&9!==e.nodeType&&11!==e.nodeType)}function Pc(e){return!(!e||1!==e.nodeType&&9!==e.nodeType&&11!==e.nodeType&&(8!==e.nodeType||" react-mount-point-unstable "!==e.nodeValue))}function Tc(){}function Lc(e,n,t,r,l){if(l){if("function"===typeof r){var a=r;r=function(){var e=wc(u);a.call(e)}}var u=bc(n,r,e,0,null,!1,!1,"",Tc);e._reactRootContainer=u;e[Ol]=u.current;cl(8===e.nodeType?e.parentNode:e);Is();return u}for(;l=e.lastChild;)e.removeChild(l);if("function"===typeof r){var i=r;r=function(){var e=wc(o);i.call(e)}}var o=gc(e,0,!1,null,null,!1,!1,"",Tc);e._reactRootContainer=o;e[Ol]=o.current;cl(8===e.nodeType?e.parentNode:e);Is((function(){kc(n,o,t,r)}));return o}function Mc(e,n,t,r,l){var a=t._reactRootContainer;if(a){var u=a;if("function"===typeof l){var i=l;l=function(){var e=wc(u);i.call(e)}}kc(n,u,e,l)}else u=Lc(t,n,e,l,r);return wc(u)}Ln=function(e){switch(e.tag){case 3:var n=e.stateNode;if(n.current.memoizedState.isDehydrated){var t=bn(n.pendingLanes);0!==t&&(zn(n,t|1),Ps(n,tn()),0===(es&6)&&(ms=tn()+500,fa()))}break;case 13:Is((function(){var n=Za(e,1);if(null!==n){var t=_s();zs(n,e,1,t)}})),xc(e,1)}};Mn=function(e){if(13===e.tag){var n=Za(e,134217728);if(null!==n){var t=_s();zs(n,e,134217728,t)}xc(e,134217728)}};Fn=function(e){if(13===e.tag){var n=Ns(e),t=Za(e,n);if(null!==t){var r=_s();zs(t,e,n,r)}xc(e,n)}};Dn=function(){return Pn};Rn=function(e,n){var t=Pn;try{return Pn=e,n()}finally{Pn=t}};Ce=function(e,n,t){switch(n){case"input":te(e,t);n=t.name;if("radio"===t.type&&null!=n){for(t=e;t.parentNode;)t=t.parentNode;t=t.querySelectorAll("input[name="+JSON.stringify(""+n)+'][type="radio"]');for(n=0;n<t.length;n++){var r=t[n];if(r!==e&&r.form===e.form){var l=Wl(r);if(!l)throw Error(a(90));G(r);te(r,l)}}}break;case"textarea":se(e,t);break;case"select":n=t.value,null!=n&&ue(e,!!t.multiple,n,!1)}};Le=Os;Me=Is;var Fc={usingClientEntryPoint:!1,Events:[Bl,Hl,Wl,Pe,Te,Os]},Dc={findFiberByHostInstance:Al,bundleType:0,version:"18.2.0",rendererPackageName:"react-dom"};var Rc={bundleType:Dc.bundleType,version:Dc.version,rendererPackageName:Dc.rendererPackageName,rendererConfig:Dc.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:x.ReactCurrentDispatcher,findHostInstanceByFiber:function(e){e=Xe(e);return null===e?null:e.stateNode},findFiberByHostInstance:Dc.findFiberByHostInstance||Ec,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.2.0-next-9e3b772b8-20220608"};if("undefined"!==typeof __REACT_DEVTOOLS_GLOBAL_HOOK__){var Oc=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!Oc.isDisabled&&Oc.supportsFiber)try{cn=Oc.inject(Rc),fn=Oc}catch(Ic){}}n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=Fc;n.createPortal=function(e,n){var t=2<arguments.length&&void 0!==arguments[2]?arguments[2]:null;if(!zc(n))throw Error(a(200));return vc(e,n,null,t)};n.createRoot=function(e,n){if(!zc(e))throw Error(a(299));var t=!1,r="",l=Cc;null!==n&&void 0!==n&&(!0===n.unstable_strictMode&&(t=!0),void 0!==n.identifierPrefix&&(r=n.identifierPrefix),void 0!==n.onRecoverableError&&(l=n.onRecoverableError));n=gc(e,1,!1,null,null,t,!1,r,l);e[Ol]=n.current;cl(8===e.nodeType?e.parentNode:e);return new _c(n)};n.findDOMNode=function(e){if(null==e)return null;if(1===e.nodeType)return e;var n=e._reactInternals;if(void 0===n){if("function"===typeof e.render)throw Error(a(188));e=Object.keys(e).join(",");throw Error(a(268,e))}e=Xe(n);e=null===e?null:e.stateNode;return e};n.flushSync=function(e){return Is(e)};n.hydrate=function(e,n,t){if(!Pc(n))throw Error(a(200));return Mc(null,e,n,!0,t)};n.hydrateRoot=function(e,n,t){if(!zc(e))throw Error(a(405));var r=null!=t&&t.hydratedSources||null,l=!1,u="",i=Cc;null!==t&&void 0!==t&&(!0===t.unstable_strictMode&&(l=!0),void 0!==t.identifierPrefix&&(u=t.identifierPrefix),void 0!==t.onRecoverableError&&(i=t.onRecoverableError));n=bc(n,null,e,1,null!=t?t:null,l,!1,u,i);e[Ol]=n.current;cl(e);if(r)for(e=0;e<r.length;e++)t=r[e],l=t._getVersion,l=l(t._source),null==n.mutableSourceEagerHydrationData?n.mutableSourceEagerHydrationData=[t,l]:n.mutableSourceEagerHydrationData.push(t,l);return new Nc(n)};n.render=function(e,n,t){if(!Pc(n))throw Error(a(200));return Mc(null,e,n,!1,t)};n.unmountComponentAtNode=function(e){if(!Pc(e))throw Error(a(40));return e._reactRootContainer?(Is((function(){Mc(null,null,e,!1,(function(){e._reactRootContainer=null;e[Ol]=null}))})),!0):!1};n.unstable_batchedUpdates=Os;n.unstable_renderSubtreeIntoContainer=function(e,n,t,r){if(!Pc(t))throw Error(a(200));if(null==e||void 0===e._reactInternals)throw Error(a(38));return Mc(e,n,t,!1,r)};n.version="18.2.0-next-9e3b772b8-20220608"},"40961":(e,n,t)=>{function r(){if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__==="undefined"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!=="function"){return}if(false){}try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(r)}catch(e){console.error(e)}}if(true){r();e.exports=t(22551)}else{}},"69982":(e,n,t)=>{if(true){e.exports=t(7463)}else{}},"96540":(e,t,r)=>{if(true){e.exports=r(15287)}else{}}};runtimeModules['44914']=(m,e,r)=>m.exports=r('96540');const rtCache={};function rt(id){if(rtCache[id])return rtCache[id].exports;const m={exports:{}};rtCache[id]=m;runtimeModules[id](m,m.exports,rt);return m.exports;}const React=rt('96540'),ReactDOM=rt('40961');
const modules={"/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/SmartComponentEditor.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartComponentEditor = SmartComponentEditor;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
const QcField_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcField.tsx");
const QcIcon_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx");
const componentTest_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/componentTest.ts");
const ComponentTestPanel_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/ComponentTestPanel.tsx");
const helpers_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/components/parts/helpers.ts");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/pricing-activation.css");
function SmartComponentEditor(props) {
    const { initial, settings: s, onSettingsChange: set, mode, saving, genericTradesEnabled } = props;
    const id = (0, react_1.useId)();
    const headingRef = (0, react_1.useRef)(null);
    const testButtonRef = (0, react_1.useRef)(null);
    const settingsButtonRef = (0, react_1.useRef)(null);
    const [name, setName] = (0, react_1.useState)(initial.name);
    const [sku, setSku] = (0, react_1.useState)(initial.sku);
    const [componentType, setComponentType] = (0, react_1.useState)(initial.componentType);
    const [materialRate, setMaterialRate] = (0, react_1.useState)(initial.materialRate);
    const [labourRate, setLabourRate] = (0, react_1.useState)(initial.labourRate);
    const [wasteAmount, setWasteAmount] = (0, react_1.useState)(initial.wasteAmount);
    const [pitchType, setPitchType] = (0, react_1.useState)(initial.pitchType === 'none' ? 'rafter' : initial.pitchType);
    const [eligible, setEligible] = (0, react_1.useState)(initial.eligibleForOrders);
    const [testOpen, setTestOpen] = (0, react_1.useState)(!!props.openTestInitially);
    const [testRequested, setTestRequested] = (0, react_1.useState)(false);
    const [testOpened, setTestOpened] = (0, react_1.useState)(!!props.openTestInitially);
    const [mobileView, setMobileView] = (0, react_1.useState)(props.openTestInitially ? 'test' : 'settings');
    function showTest() { setTestOpened(true); setTestOpen(true); setTestRequested(true); setMobileView('test'); }
    (0, react_1.useEffect)(() => {
        if (props.testRequest) {
            setTestOpened(true);
            setTestOpen(true);
            setTestRequested(true);
            setMobileView('test');
        }
    }, [props.testRequest]);
    function closeTest() {
        setTestOpen(false);
        setMobileView('settings');
        requestAnimationFrame(() => {
            const target = testButtonRef.current?.offsetParent ? testButtonRef.current : settingsButtonRef.current;
            target?.focus({ preventScroll: true });
        });
    }
    function showSettings() {
        setMobileView('settings');
        requestAnimationFrame(() => settingsButtonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }));
    }
    const labels = (0, helpers_1.buildMeasurementLabels)(props.measurementSystem);
    const unit = (0, componentTest_1.canonicalUnit)(s.measurementType, s.hoursUnit);
    const strategy = genericTradesEnabled ? s.pricingStrategy : initial.storedStrategy ?? 'per_unit';
    const packPricing = strategy !== 'per_unit';
    const gatedPack = !genericTradesEnabled && packPricing;
    const purchaseUnit = strategy === 'per_pack_length' ? 'm' : strategy === 'per_pack_volume' ? 'm³' : 'm²';
    const draft = { name, measurementType: s.measurementType, materialRate, labourRate,
        wasteType: s.wasteType, wasteAmount, pitchType: s.pitchEnabled ? pitchType : 'none', strategy,
        packPrice: genericTradesEnabled ? s.packPrice : initial.storedPackPrice ?? '',
        packSize: genericTradesEnabled ? s.packSize : initial.storedPackSize ?? '',
        packCoverage: genericTradesEnabled ? s.packCoverage : initial.storedPackCoverage ?? '',
        heightMm: genericTradesEnabled ? s.heightMm : initial.storedHeightMm ?? '',
        depthMm: genericTradesEnabled ? s.depthMm : initial.storedDepthMm ?? '', timeUnit: s.hoursUnit };
    (0, react_1.useEffect)(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
    (0, react_1.useEffect)(() => { if (props.error)
        headingRef.current?.scrollIntoView({ block: 'nearest' }); }, [props.error]);
    const numberField = (key, label, value, update, options) => ((0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-${key}`, label: label, help: options?.help, helpId: options?.help ? `${id}-${key}-help` : undefined, children: (0, jsx_runtime_1.jsx)(QcField_1.QcInput, { id: `${id}-${key}`, name: options?.name, type: "number", inputMode: "decimal", step: options?.step ?? '0.01', value: value, placeholder: "0", "aria-describedby": options?.help ? `${id}-${key}-help` : undefined, onChange: e => update(e.target.value) }) }));
    const copyInitial = () => ({ ...initial, name: `${name || 'Component'} (copy)`, sku: '', componentType,
        materialRate, labourRate, wasteAmount, pitchType: s.pitchEnabled ? pitchType : 'none', eligibleForOrders: eligible });
    return (0, jsx_runtime_1.jsxs)("section", { className: "qc-component-editor", "data-mobile-view": mobileView, "data-qc-ui": "v2", "data-qc-component": "C69", "aria-labelledby": `${id}-title`, children: [(0, jsx_runtime_1.jsxs)("header", { className: "qc-pricing-editor-header", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "qc-eyebrow", children: "Your reusable pricing" }), (0, jsx_runtime_1.jsx)("h2", { id: `${id}-title`, ref: headingRef, tabIndex: -1, children: mode === 'create' ? 'Create a Smart Component' : name || 'Edit Smart Component' }), (0, jsx_runtime_1.jsx)("p", { children: "Define it once. Add a measurement to use it on a job." })] }), (0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { ref: testButtonRef, className: "qc-pricing-desktop-test-toggle", variant: testOpen ? 'ghost' : 'secondary', disabled: saving, "aria-expanded": testOpen, "aria-controls": `${id}-test`, onClick: () => { if (testOpen)
                            closeTest();
                        else
                            showTest(); }, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "pricing" }), testOpen ? 'Hide test' : 'Test component'] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-mobile-tabs", role: "group", "aria-label": "Component workspace", children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { ref: settingsButtonRef, "aria-pressed": mobileView === 'settings', "aria-controls": `${id}-settings`, disabled: saving, onClick: showSettings, children: "Settings" }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { "aria-pressed": mobileView === 'test', "aria-controls": `${id}-test`, disabled: saving, onClick: showTest, children: "Test component" })] }), props.error && (0, jsx_runtime_1.jsx)("div", { className: "qc-pricing-error", role: "alert", children: props.error }), props.learning && (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-callout", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Learn with an example, then use your own costs." }), " Starter prices and settings are examples, not recommendations. Replace the costs and check the rules before using them in a real quote."] }), (0, jsx_runtime_1.jsx)("form", { "aria-busy": saving || undefined, onSubmit: props.onSubmit, onChange: event => {
                    if (!event.target.closest('[data-qc-component="C70"]'))
                        props.onDirty();
                }, children: (0, jsx_runtime_1.jsxs)("fieldset", { disabled: saving, className: "qc-pricing-fieldset", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-editor-grid", "data-test-open": testOpen, children: [(0, jsx_runtime_1.jsxs)("div", { id: `${id}-settings`, className: "qc-pricing-fields", children: [(0, jsx_runtime_1.jsxs)("section", { className: "qc-pricing-section", "aria-labelledby": `${id}-identity`, children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsx)("span", { children: "1" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { id: `${id}-identity`, children: "What are you pricing?" }), (0, jsx_runtime_1.jsx)("p", { children: "A product, service or charge you can recognise later." })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-fields-grid", children: [(0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-name", children: (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-name`, label: "Component name", children: (0, jsx_runtime_1.jsx)(QcField_1.QcInput, { id: `${id}-name`, name: "name", required: true, value: name, placeholder: "e.g. Roofing underlay", onChange: e => setName(e.target.value) }) }) }), (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-sku", children: (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-sku`, label: `Product code / SKU${props.supplierSkuRequired ? ' (required for publishing)' : ' (optional)'}`, help: mode === 'edit' && initial.sku ? 'An existing product code cannot be changed.' : undefined, children: (0, jsx_runtime_1.jsx)(QcField_1.QcInput, { id: `${id}-sku`, name: "sku", value: sku, readOnly: mode === 'edit' && !!initial.sku, onChange: e => setSku(e.target.value), placeholder: "Your reference code" }) }) }), mode === 'create' && (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-type", children: (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-type`, label: "Used as", help: "Main items form the job. Extras cover additional work or charges.", children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { id: `${id}-type`, name: "component_type", value: componentType, onChange: e => setComponentType(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "main", children: "Main component" }), (0, jsx_runtime_1.jsx)("option", { value: "extra", children: "Extra" })] }) }) }), (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-measurement", children: (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-measurement`, label: "How do you measure it?", help: "Choose what you enter on a job. Purchasing is set separately below.", children: (0, jsx_runtime_1.jsx)(QcField_1.QcSelect, { id: `${id}-measurement`, name: "measurement_type", value: s.measurementType, onChange: e => set({ measurementType: e.target.value }), children: Object.entries(labels).filter(([key]) => key === s.measurementType ||
                                                                        (!['linear', 'count', 'curved_line', 'irregular_area'].includes(key) && (genericTradesEnabled || helpers_1.ROOFING_DEFAULT_TYPES.has(key))))
                                                                        .map(([key, label]) => (0, jsx_runtime_1.jsx)("option", { value: key, children: label }, key)) }) }) }), genericTradesEnabled && ['length_x_height', 'multi_lineal_lxh'].includes(s.measurementType) && numberField('height', 'Preset height (mm)', s.heightMm, value => set({ heightMm: value }), { step: '1', help: 'Measured length × this height gives the priced area.' }), genericTradesEnabled && s.measurementType === 'volume' && numberField('depth', 'Preset depth (mm)', s.depthMm, value => set({ depthMm: value }), { step: '1', help: 'Measured area × this depth gives the priced volume.' }), genericTradesEnabled && s.measurementType === 'hours_days' && (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-time`, label: "Time unit for this test", help: "Keep your quoted time and rate on the same basis. This display choice does not convert rates.", children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { id: `${id}-time`, value: s.hoursUnit, onChange: e => set({ hoursUnit: e.target.value }), children: [(0, jsx_runtime_1.jsx)("option", { value: "hr", children: "Hours" }), (0, jsx_runtime_1.jsx)("option", { value: "day", children: "Days" })] }) })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "qc-pricing-section", "aria-labelledby": `${id}-costs`, children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsx)("span", { children: "2" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { id: `${id}-costs`, children: "What does it cost you?" }), (0, jsx_runtime_1.jsxs)("p", { children: ["Enter your business costs in ", props.currency, ". Quote margins and tax are added later."] })] })] }), props.measurementSystem !== 'metric' && (0, jsx_runtime_1.jsxs)("p", { className: "qc-pricing-callout", children: ["Pricing settings use ", unit, ". You can enter your test measurement in your preferred units; QuoteCore converts that measurement before calculating."] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-fields-grid", children: [genericTradesEnabled && (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-strategy`, label: "How do you buy the material?", children: (0, jsx_runtime_1.jsx)(QcField_1.QcSelect, { id: `${id}-strategy`, value: s.pricingStrategy, onChange: e => set({ pricingStrategy: e.target.value }), children: [...(0, helpers_1.allowedStrategiesFor)(s.measurementType), ...(s.pricingStrategy === 'per_pack_coverage' ? ['per_pack_coverage'] : [])].map(value => (0, jsx_runtime_1.jsx)("option", { value: value, children: value === 'per_unit' ? `Per ${unit}` : value === 'per_pack_coverage' ? 'By coverage per pack (existing)' : 'Whole rolls, packs or fixed quantities' }, value)) }) }), (!genericTradesEnabled || !packPricing) && (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-rates", children: numberField('material', `Material cost per ${unit} (${props.currency})`, materialRate, setMaterialRate, { name: 'default_material_rate', help: gatedPack ? 'This saved component uses its pack price below, not this unit rate.' : 'Enter 0 for a labour-only component.' }) }), genericTradesEnabled && packPricing && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("input", { type: "hidden", name: "default_material_rate", value: "0" }), numberField('pack-price', `Price per roll / pack (${props.currency})`, s.packPrice, value => set({ packPrice: value })), numberField('pack-size', `Amount in one roll / pack (${strategy === 'per_pack_coverage' ? 'pack units' : purchaseUnit})`, s.packSize, value => set({ packSize: value }), { help: strategy === 'per_pack_length' ? 'For example, 20 for a 20 m roll. Purchases round up to whole rolls.' : strategy === 'per_pack_volume' ? 'For example, 5 for a 5 m³ load. Purchases round up to whole units.' : strategy === 'per_pack_coverage' ? 'Keep the saved pack size. Coverage below determines the amount purchased.' : 'For example, 50 for a roll that covers 50 m². Purchases round up to whole packs.' }), strategy === 'per_pack_coverage' && numberField('coverage', 'Coverage per pack (m²)', s.packCoverage, value => set({ packCoverage: value }))] }), (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-labour", children: numberField('labour', `Labour cost per ${unit} (${props.currency})`, labourRate, setLabourRate, { name: 'default_labour_rate', help: 'Enter 0 when no labour applies. Labour uses the quantity after allowances.' }) })] }), gatedPack && (0, jsx_runtime_1.jsxs)("p", { className: "qc-pricing-callout", children: ["Saved pack settings are used in the test: ", initial.storedPackSize, " ", purchaseUnit, " per pack, ", initial.storedPackPrice, " ", props.currency, ". Pack editing is disabled by this workspace configuration."] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "qc-pricing-section", "aria-labelledby": `${id}-rules`, children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsx)("span", { children: "3" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { id: `${id}-rules`, children: "What allowances apply?" }), (0, jsx_runtime_1.jsx)("p", { children: "Leave these off when they do not apply." })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-fields-grid", children: [(0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-waste", children: (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-waste`, label: "Waste allowance", children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { id: `${id}-waste`, name: "default_waste_type", value: s.wasteType, onChange: e => set({ wasteType: e.target.value }), children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "No waste" }), (0, jsx_runtime_1.jsx)("option", { value: "percent", children: "Percentage of measurement" }), (0, jsx_runtime_1.jsx)("option", { value: "fixed", children: "Fixed amount per entry" }), (0, jsx_runtime_1.jsx)("option", { value: "fixed_per_segment", children: "Fixed amount per segment" })] }) }) }), s.wasteType !== 'none' && (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-waste-amount", children: numberField('waste-amount', `Allowance (${s.wasteType === 'percent' ? '%' : unit})`, wasteAmount, setWasteAmount, { name: 'waste_amount', help: s.wasteType === 'percent' ? 'For example, 10 adds 10% to the measurement.' : 'The test shows the allowance added to each manual entry.' }) })] }), (props.pitchVisible || s.pitchEnabled) && (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-pitch", "data-copilot": "component-pitch", children: [(0, jsx_runtime_1.jsxs)("label", { className: "qc-pricing-check", children: [(0, jsx_runtime_1.jsx)("input", { id: `${id}-pitch-enabled`, type: "checkbox", checked: s.pitchEnabled, onChange: e => set({ pitchEnabled: e.target.checked }) }), props.pitchCheckboxLabel] }), s.pitchEnabled && (0, jsx_runtime_1.jsx)("div", { "data-copilot": "component-pitch-type", children: (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-pitch-type`, label: "Pitch rule", help: "In the test, choose a plan measurement to apply this rule, or an already-measured surface to skip it.", children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { id: `${id}-pitch-type`, name: "default_pitch_type", value: pitchType, onChange: e => setPitchType(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "rafter", children: props.pitchRafterLabel }), (!props.pitchHidesValleyHip || pitchType === 'valley_hip') && (0, jsx_runtime_1.jsx)("option", { value: "valley_hip", children: "Valley / hip pitch" })] }) }) })] })] }), (0, jsx_runtime_1.jsxs)("details", { className: "qc-pricing-details", children: [(0, jsx_runtime_1.jsxs)("summary", { children: ["Notes, images & material orders ", (0, jsx_runtime_1.jsx)("span", { children: props.assignedFlashings.length ? `${props.assignedFlashings.length} image(s)` : 'Optional' })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { "data-copilot": "component-flashings", children: [(0, jsx_runtime_1.jsxs)("label", { className: "qc-pricing-check", children: [(0, jsx_runtime_1.jsx)("input", { name: "eligible_for_orders", type: "checkbox", checked: eligible, onChange: e => setEligible(e.target.checked) }), " Include in material orders"] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-pricing-muted", children: props.imageHelperText }), (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-image`, label: "Attach an existing image", children: (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-inline", children: [(0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { id: `${id}-image`, value: props.selectedFlashingId, onChange: e => props.onFlashingSelection(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Select an image" }), props.flashings.map(image => (0, jsx_runtime_1.jsxs)("option", { value: image.id, children: [image.name, image.description ? ` - ${image.description}` : ''] }, image.id))] }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { disabled: !props.selectedFlashingId, onClick: () => { props.onDirty(); props.onAddFlashing(); }, children: "Add" })] }) }), props.assignedFlashings.map(imageId => (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-attached", children: [(0, jsx_runtime_1.jsx)("span", { children: props.flashings.find(image => image.id === imageId)?.name || 'Assigned image' }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { size: "sm", onClick: () => { props.onDirty(); props.onRemoveFlashing(imageId); }, "aria-label": `Remove ${props.flashings.find(image => image.id === imageId)?.name || 'assigned image'}`, children: "Remove" })] }, imageId))] }), (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-notes`, label: "Notes (optional)", help: "Usage tips for your team. Up to 500 characters.", children: (0, jsx_runtime_1.jsx)("textarea", { id: `${id}-notes`, className: "qc-input", value: s.notes, maxLength: 500, rows: 3, onChange: e => set({ notes: e.target.value }) }) })] })] }), props.collections.length > 0 && (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-library`, label: "Save to library", children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { id: `${id}-library`, value: props.selectedCollectionId, onChange: e => props.onCollectionChange(e.target.value), children: [props.collections.map(collection => (0, jsx_runtime_1.jsxs)("option", { value: collection.id, children: [collection.name, collection.is_bootstrap ? ' (default)' : ''] }, collection.id)), (0, jsx_runtime_1.jsx)("option", { value: "__create_new__", children: "+ Create new library" })] }) })] }), testOpened && (0, jsx_runtime_1.jsx)("div", { id: `${id}-test`, className: "qc-pricing-test-column", hidden: !testOpen, children: (0, jsx_runtime_1.jsx)(ComponentTestPanel_1.ComponentTestPanel, { draft: draft, measurementSystem: props.measurementSystem, currency: props.currency, focusOnMount: testRequested && testOpen, onCalculated: props.onCalculated, onClose: closeTest }, s.measurementType) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-mobile-test-footer", children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "secondary", onClick: showSettings, children: "Adjust component settings" }), (0, jsx_runtime_1.jsx)("p", { children: "Return to settings to save. Your test stays here while you make changes." })] }), (0, jsx_runtime_1.jsxs)("footer", { className: "qc-pricing-editor-footer", "data-copilot": "component-save", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { variant: "primary", type: "submit", pending: saving, children: saving ? 'Saving...' : 'Save component' }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { disabled: saving, onClick: props.onCancel, children: "Cancel" })] }), mode === 'edit' && props.onCopy && !gatedPack && (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { disabled: saving, onClick: () => props.onCopy?.(copyInitial()), children: "Use these settings for a new component" }), (0, jsx_runtime_1.jsx)("p", { children: "Testing does not save. Save explicitly when your settings are ready." })] })] }) })] });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcLinkButton = exports.QcButton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc.css");
/** C01. Native button/ref/form semantics; no request, pricing or permission logic. */
exports.QcButton = (0, react_1.forwardRef)(function QcButton({ variant = 'ghost', size = 'md', pending = false, disabled, type = 'button', className = '', children, ...props }, ref) {
    return ((0, jsx_runtime_1.jsx)("button", { ...props, ref: ref, type: type, disabled: disabled || pending, "aria-busy": pending || props['aria-busy'] || undefined, "data-qc-component": "C01", "data-qc-variant": variant, "data-qc-size": size, className: `qc-button ${className}`, children: children }));
});
/** C02. For native links. Next Link can use the same class/data recipe directly. */
exports.QcLinkButton = (0, react_1.forwardRef)(function QcLinkButton({ variant = 'ghost', size = 'md', className = '', ...props }, ref) {
    return (0, jsx_runtime_1.jsx)("a", { ...props, ref: ref, "data-qc-component": "C02", "data-qc-variant": variant, "data-qc-size": size, className: `qc-button ${className}` });
});

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcField.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcSelect = exports.QcInput = void 0;
exports.QcField = QcField;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc.css");
/** C05. Pass numeric strings, units, events and validation through unchanged. */
exports.QcInput = (0, react_1.forwardRef)(function QcInput({ className = '', ...props }, ref) {
    return (0, jsx_runtime_1.jsx)("input", { ...props, ref: ref, "data-qc-component": "C05", className: `qc-input ${className}` });
});
/** C06. Keep native keyboard selection and the caller's complete option set. */
exports.QcSelect = (0, react_1.forwardRef)(function QcSelect({ className = '', ...props }, ref) {
    return (0, jsx_runtime_1.jsx)("select", { ...props, ref: ref, "data-qc-component": "C06", className: `qc-select ${className}` });
});
/** C04. Callers connect help/error ids to their control with aria-describedby. */
function QcField({ label, htmlFor, children, help, helpId, className = '' }) {
    return (0, jsx_runtime_1.jsxs)("div", { "data-qc-component": "C04", className: `qc-field ${className}`, children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: htmlFor, className: "qc-label", children: label }), children, help && (0, jsx_runtime_1.jsx)("p", { id: helpId, className: "qc-help", children: help })] });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcIcon = QcIcon;
const jsx_runtime_1 = require("react/jsx-runtime");
const paths = {
    polygon: 'm4 8 9-5 7 7-4 10H5L4 8Z',
    line: 'M5 19 19 5M3 17h4v4H3v-4ZM17 3h4v4h-4V3Z',
    point: 'M12 8v8M8 12h8M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    pitch: 'M3 19 21 5v14H3ZM15 19v-5h6',
    trash: 'M3 6h18M5 6l1 15h12l1-15M9 6V3h6v3M10 10v7M14 10v7',
    undo: 'M9 15 3 9l6-6M3 9h12a6 6 0 0 1 0 12h-3',
    redo: 'm15 15 6-6-6-6m6 6H9a6 6 0 0 0 0 12h3',
    minus: 'M5 12h14',
    home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
    quote: 'M7 3h7l4 4v14H6V3h1m7 0v5h4M9 12h6m-6 4h6',
    orders: 'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5l9 4',
    invoice: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
    pricing: 'M4 8h16v12H4V8Zm2 0V5h12v3M8 5V2h8v3M9 12h6m-6 4h6',
    library: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
    supplier: 'M3 21V10l6 3V8l6 3V3h6v18H3Zm4-4h1m3 0h1m5 0h1',
    help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-12a3 3 0 1 1 4 2.8c-1 .4-1 1.2-1 2.2m0 3v.1',
    account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8a8 8 0 0 1 16 0',
    assistant: 'M4 4h16v12h-8l-5 4v-4H4V4Zm4 6h.1m3.9 0h.1m3.9 0h.1',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
    collapse: 'M4 4h16v16H4V4Zm5 0v16m7-12-4 4 4 4',
    expand: 'M4 4h16v16H4V4Zm5 0v16m3-12 4 4-4 4',
    focus: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    back: 'M20 12H4m6-6-6 6 6 6',
    chevron: 'm9 5 7 7-7 7',
    plus: 'M12 5v14M5 12h14',
    lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 4v3',
    measure: 'm4 16 12-12 4 4L8 20l-4-4Zm9-9 3 3m-6 0 2 2m-5 1 3 3',
    file: 'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6',
    folder: 'M3 6h7l2 2h9v12H3V6Z',
    notes: 'M5 3h14v14l-4 4H5V3Zm10 18v-5h4M8 7h8m-8 4h8m-8 4h3',
    activity: 'M3 12h4l3-8 4 16 3-8h4',
    mail: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2',
    check: 'm5 12 4 4L19 6',
    edit: 'm15 4 5 5M4 20l5-1L21 7l-4-4L5 15l-1 5Z',
    upload: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
    download: 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    more: 'M5 12h.1m6.9 0h.1m6.9 0h.1',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9v.1',
    labour: 'M8 7V5h8v2m-13 0h18v13H3V7Zm0 6 9 3 9-3m-9 1v4',
};
/** Shared outline vocabulary. Always pair an icon-only control with an accessible name. */
function QcIcon({ name, ...props }) {
    return (0, jsx_runtime_1.jsx)("svg", { "aria-hidden": "true", width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.65", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: (0, jsx_runtime_1.jsx)("path", { d: paths[name] }) });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/componentTest.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricedDimension = pricedDimension;
exports.inputDimension = inputDimension;
exports.unitForDimension = unitForDimension;
exports.canonicalUnit = canonicalUnit;
exports.displayQuantity = displayQuantity;
exports.calculateComponentTest = calculateComponentTest;
const types_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/types.ts");
const engine_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/pricing/engine.ts");
const conversions_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/measurements/conversions.ts");
const LENGTH_TYPES = new Set(['lineal', 'linear', 'multi_lineal', 'curved_line']);
const AREA_TYPES = new Set(['area', 'irregular_area', 'length_x_height', 'multi_lineal_lxh', 'length_x_height_freestyle', 'multi_lineal_lxh_freestyle']);
const PRESET_HEIGHT = new Set(['length_x_height', 'multi_lineal_lxh']);
function pricedDimension(type) {
    if (LENGTH_TYPES.has(type))
        return 'length';
    if (AREA_TYPES.has(type))
        return 'area';
    if (type === 'volume' || type === 'volume_3d')
        return 'volume';
    if (type === 'fixed')
        return 'fixed';
    if (type === 'hours_days')
        return 'time';
    return 'quantity';
}
function inputDimension(type) {
    if (PRESET_HEIGHT.has(type))
        return 'length';
    if (type === 'volume')
        return 'area';
    return pricedDimension(type);
}
function unitForDimension(dimension, system, timeUnit = 'hr') {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (dimension === 'length')
        return norm === 'metric' ? 'm' : 'ft';
    if (dimension === 'area')
        return norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
    if (dimension === 'volume')
        return norm === 'metric' ? 'm³' : 'ft³';
    return dimension === 'time' ? timeUnit : dimension === 'fixed' ? 'charge' : 'each';
}
function canonicalUnit(type, timeUnit = 'hr') {
    return unitForDimension(pricedDimension(type), 'metric', timeUnit);
}
function displayQuantity(value, dimension, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return value;
    if (dimension === 'length')
        return (0, conversions_1.convertLinear)(value);
    if (dimension === 'area')
        return norm === 'imperial_ft' ? (0, conversions_1.convertAreaFt2)(value) : (0, conversions_1.convertAreaRs)(value);
    if (dimension === 'volume')
        return (0, conversions_1.convertVolumeFt3)(value);
    return value;
}
function toMetric(value, dimension, system) {
    if (dimension === 'length')
        return (0, conversions_1.linearInputToMetric)(value, system);
    if (dimension === 'area')
        return (0, conversions_1.areaInputToMetric)(value, system);
    if (dimension === 'volume')
        return (0, conversions_1.volumeInputToMetric)(value, system);
    return value;
}
function calculateComponentTest(draft, input) {
    const errors = {};
    function number(raw, key, label, positive = false) {
        const n = Number(raw);
        if (raw.trim() === '' || !Number.isFinite(n) || (positive ? n <= 0 : n < 0)) {
            errors[key] = `${label}: enter ${positive ? 'a number above zero' : 'zero or a positive number'}.`;
            return 0;
        }
        return n;
    }
    const dimension = pricedDimension(draft.measurementType);
    const inDimension = inputDimension(draft.measurementType);
    const packStrategy = draft.strategy !== 'per_unit';
    const materialRate = packStrategy ? 0 : number(draft.materialRate, 'materialRate', 'Material cost');
    const labourRate = number(draft.labourRate, 'labourRate', 'Labour cost');
    const wasteAmount = draft.wasteType === 'none' ? 0 : number(draft.wasteAmount, 'wasteAmount', 'Waste allowance');
    const packPrice = packStrategy ? number(draft.packPrice, 'packPrice', 'Pack price', true) : null;
    const packSize = packStrategy ? number(draft.packSize, 'packSize', 'Pack size', true) : null;
    const packCoverage = draft.strategy === 'per_pack_coverage' ? number(draft.packCoverage, 'packCoverage', 'Coverage per pack', true) : null;
    const height = PRESET_HEIGHT.has(draft.measurementType) ? number(draft.heightMm, 'heightMm', 'Component height in mm', true) / 1000 : 1;
    const depth = draft.measurementType === 'volume' ? number(draft.depthMm, 'depthMm', 'Component depth in mm', true) / 1000 : 1;
    // Do not silently ignore a persisted unusual pitch rule. Match the selected
    // component's rule, but make plan/surface basis explicit in the UI.
    const pitchApplied = draft.pitchType !== 'none' && input.basis === 'plan';
    const pitch = pitchApplied ? number(input.pitch, 'pitch', 'Pitch in degrees') : 0;
    if (pitchApplied && pitch >= 90)
        errors.pitch = 'Pitch must be below 90 degrees.';
    const values = dimension === 'fixed' ? [1] : input.values.map((raw, i) => number(raw, `value-${i}`, `Measurement ${i + 1}`, true));
    if (values.length === 0)
        errors.values = 'Add a measurement to test.';
    const compatible = draft.strategy === 'per_unit'
        || (draft.strategy === 'per_pack_length' && dimension === 'length')
        || ((draft.strategy === 'per_pack_area' || draft.strategy === 'per_pack_coverage') && dimension === 'area')
        || (draft.strategy === 'per_pack_volume' && dimension === 'volume');
    if (!compatible)
        errors.strategy = 'Choose a purchasing method that matches this measurement type.';
    if (Object.keys(errors).length)
        return { ok: false, errors };
    const entries = values.map(value => {
        const measured = toMetric(value, inDimension, input.system) * height * depth;
        const adjusted = (0, engine_1.applyPitchAndWaste)(measured, pitchApplied, draft.pitchType, pitch, draft.wasteType, draft.wasteType === 'percent' ? wasteAmount : 0, draft.wasteType === 'fixed' || draft.wasteType === 'fixed_per_segment' ? wasteAmount : 0);
        return { input: value, measured, afterPitch: adjusted.afterPitch, afterWaste: adjusted.afterWaste };
    });
    const entered = values.reduce((a, b) => a + b, 0);
    const measured = entries.reduce((sum, e) => sum + e.measured, 0);
    const afterPitch = entries.reduce((sum, e) => sum + e.afterPitch, 0);
    const required = entries.reduce((sum, e) => sum + e.afterWaste, 0);
    const material = (0, engine_1.computeMaterialCostByStrategy)({ strategy: draft.strategy, totalQuantity: required,
        materialRate, packPrice, packSize, packCoverageM2: packCoverage });
    if (material.packDataMissing)
        return { ok: false, errors: { packSize: 'Complete the pack price and size before testing.' } };
    const packs = (0, engine_1.computePackCount)({ strategy: draft.strategy, totalQuantity: required, packSize, packCoverageM2: packCoverage });
    // EXACT caller convention in recalcComponentFromEntries. Do not use purchased
    // coverage or a second waste calculation for labour.
    const labourCost = required * labourRate;
    const total = material.cost + labourCost;
    const purchased = packStrategy ? packs * (draft.strategy === 'per_pack_coverage' ? packCoverage : packSize) : null;
    if (![measured, afterPitch, required, material.cost, labourCost, total, purchased ?? 0].every(Number.isFinite)) {
        return { ok: false, errors: { values: 'These values are too large to calculate safely. Reduce the measurement or rates.' } };
    }
    return { ok: true, result: { entered, measured, afterPitch, required, wasteAdded: required - afterPitch,
            packs, purchased, spare: purchased === null ? null : Math.max(0, purchased - required),
            materialCost: material.cost, labourCost, total, effectiveCost: entered > 0 ? total / entered : null,
            entryCount: values.length, pitchApplied, entries } };
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/lib/types.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMeasurementSystem = normalizeMeasurementSystem;
exports.unitForMeasurement = unitForMeasurement;
exports.wasteAmountSuffix = wasteAmountSuffix;
exports.entryLabel = entryLabel;
exports.addMoreLabel = addMoreLabel;
exports.measurementTypeLabel = measurementTypeLabel;
/** Narrow a possibly-legacy MeasurementSystem to the canonical 4-value set callers should branch on. */
function normalizeMeasurementSystem(system) {
    if (system === 'imperial_ft')
        return 'imperial_ft';
    // Legacy 'imperial' rows were always Roofing Squares in practice.
    if (system === 'imperial' || system === 'imperial_rs')
        return 'imperial_rs';
    return 'metric';
}
/**
 * Metric-only unit label for a measurement type. Used by system-agnostic
 * contexts like the component library (which spans every quote regardless of
 * unit system).
 *
 * NOTE: For per-quote rendering use `getUnitLabel(measurementType, system)` from
 * `@/app/lib/measurements/displayHelpers` instead, which knows how to render
 * ft, ft², and Roofing Squares for Imperial quotes.
 */
function unitForMeasurement(mt) {
    switch (mt) {
        case 'area': return 'm²';
        case 'lineal': return 'm';
        case 'linear': return 'm'; // legacy alias
        case 'multi_lineal': return 'm';
        case 'multi_lineal_lxh': return 'm\u00b2';
        case 'quantity': return 'each';
        case 'count': return 'each'; // Phase 2 alias
        case 'fixed': return 'fixed';
        case 'length_x_height': return 'm²'; // length × component height
        case 'volume': return 'm³';
        case 'volume_3d': return 'm³'; // true 3D: L × W × D
        case 'length_x_height_freestyle': return 'm²';
        case 'multi_lineal_lxh_freestyle': return 'm²';
        case 'hours_days': return 'hr'; // unit refined by component config
        case 'curved_line': return 'm';
        case 'irregular_area': return 'm²';
        default: return '';
    }
}
function wasteAmountSuffix(wt, mt) {
    if (wt === 'percent')
        return '%';
    if (wt === 'fixed' || wt === 'fixed_per_segment')
        return unitForMeasurement(mt);
    return '';
}
function entryLabel(mt) {
    switch (mt) {
        case 'area': return 'area';
        case 'lineal':
        case 'linear':
        case 'multi_lineal':
        case 'multi_lineal_lxh':
        case 'curved_line': return 'length';
        case 'quantity':
        case 'count': return 'items';
        case 'fixed': return 'value';
        case 'length_x_height': return 'length';
        case 'volume': return 'area';
        case 'volume_3d': return 'L × W × D';
        case 'length_x_height_freestyle': return 'length × height';
        case 'multi_lineal_lxh_freestyle': return 'length × height';
        case 'hours_days': return 'time';
        case 'irregular_area': return 'area';
        default: return '';
    }
}
function addMoreLabel(mt) {
    switch (mt) {
        case 'area': return 'Add more areas';
        case 'lineal':
        case 'linear':
        case 'multi_lineal':
        case 'multi_lineal_lxh':
        case 'curved_line': return 'Add more lengths';
        case 'quantity':
        case 'count': return 'Add more items';
        case 'fixed': return 'Add entry';
        case 'length_x_height': return 'Add more lengths';
        case 'volume': return 'Add more areas';
        case 'volume_3d': return 'Add volume entry';
        case 'length_x_height_freestyle': return 'Add more lengths';
        case 'multi_lineal_lxh_freestyle': return 'Add more lengths';
        case 'hours_days': return 'Add more time';
        case 'irregular_area': return 'Add more areas';
        default: return 'Add entry';
    }
}
/**
 * Human-friendly display name for a measurement type, with optional unit system
 * for unit suffix. Used wherever the raw enum value would be shown to users.
 */
function measurementTypeLabel(mt, system) {
    const norm = system ? normalizeMeasurementSystem(system) : 'metric';
    const areaUnit = norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
    const linealUnit = norm === 'metric' ? 'm' : 'ft';
    const volumeUnit = norm === 'metric' ? 'm³' : 'ft³';
    switch (mt) {
        case 'area': return `Area (${areaUnit})`;
        case 'lineal': return `Linear (${linealUnit})`;
        case 'linear': return `Linear (${linealUnit})`;
        case 'quantity': return 'Quantity';
        case 'fixed': return 'Fixed';
        case 'length_x_height': return `Length × Height (${areaUnit})`;
        case 'volume': return `Volume - Preset Depth (${volumeUnit})`;
        case 'volume_3d': return `Volume (${volumeUnit})`;
        case 'hours_days': return 'Hours / Days';
        case 'count': return 'Count';
        case 'curved_line': return `Curved Line (${linealUnit})`;
        case 'irregular_area': return `Irregular Area (${areaUnit})`;
        case 'multi_lineal': return `Linear: Multi-Length (${linealUnit})`;
        case 'multi_lineal_lxh': return `Length × Height: Multi-Length (${areaUnit})`;
        case 'length_x_height_freestyle': return `Length × Height: Custom (${areaUnit})`;
        case 'multi_lineal_lxh_freestyle': return `Length × Height: Multi-Length Custom (${areaUnit})`;
        default: return String(mt);
    }
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/lib/pricing/engine.ts":function(require,module,exports){
"use strict";
// QuoteCore+ v2 Pricing Engine
// Unified calculation: dual input → pitch → waste → costs
Object.defineProperty(exports, "__esModule", { value: true });
exports.rafterPitchFactor = rafterPitchFactor;
exports.hipValleyPitchFactor = hipValleyPitchFactor;
exports.pitchFactor = pitchFactor;
exports.applyWaste = applyWaste;
exports.applyPitchAndWaste = applyPitchAndWaste;
exports.computeRoofArea = computeRoofArea;
exports.totalRoofArea = totalRoofArea;
exports.computeMaterialCostByStrategy = computeMaterialCostByStrategy;
exports.computePackCount = computePackCount;
exports.computeQuoteTotals = computeQuoteTotals;
// ─── Pitch Calculations ──────────────────────────────
const RAD = Math.PI / 180;
/** Rafter pitch factor: actual = plan / cos(pitch) */
function rafterPitchFactor(degrees) {
    if (!degrees || degrees <= 0 || degrees >= 90)
        return 1;
    return 1 / Math.cos(degrees * RAD);
}
/** Hip/Valley pitch factor: compound angle for 45° hip/valley
 *  hip_angle = arctan(tan(pitch) × cos(45°))
 *  hip_factor = 1 / cos(hip_angle)
 *  This is equivalent to sqrt(1 + tan²(pitch)/2) — a standard roofing formula. */
function hipValleyPitchFactor(degrees) {
    if (!degrees || degrees <= 0 || degrees >= 90)
        return 1;
    const tangent = Math.tan(degrees * RAD);
    return Math.sqrt(1 + (tangent * tangent) / 2);
}
/** Get pitch factor based on pitch type */
function pitchFactor(degrees, pitchType = 'rafter') {
    if (pitchType === 'valley_hip')
        return hipValleyPitchFactor(degrees);
    if (pitchType === 'rafter')
        return rafterPitchFactor(degrees);
    return 1;
}
// ─── Waste ───────────────────────────────────────────
function applyWaste(value, wasteType, wastePercent, wasteFixed) {
    switch (wasteType) {
        case 'percent': return value * (1 + (wastePercent || 0) / 100);
        case 'fixed': return value + (wasteFixed || 0);
        // fixed_per_segment: in manual entry (1 segment per entry) this is
        // equivalent to plain fixed. The digital takeoff path converts
        // multi-segment counts before calling this function; this fallback
        // ensures manual entries still get waste applied.
        case 'fixed_per_segment': return value + (wasteFixed || 0);
        default: return value;
    }
}
/** Apply pitch then waste to a raw plan value */
function applyPitchAndWaste(rawValue, isPlan, pitchType, pitchDegrees, wasteType, wastePercent, wasteFixed) {
    let pitchFactorUsed = 1;
    let afterPitch = rawValue;
    if (isPlan && pitchType !== 'none' && pitchDegrees > 0) {
        pitchFactorUsed = pitchFactor(pitchDegrees, pitchType);
        afterPitch = rawValue * pitchFactorUsed;
    }
    const afterWaste = applyWaste(afterPitch, wasteType, wastePercent, wasteFixed);
    return { afterPitch, afterWaste, pitchFactorUsed };
}
// ─── Roof Area ───────────────────────────────────────
function computeRoofArea(area) {
    if (area.inputMode === 'final')
        return area.finalValueSqm ?? 0;
    let planSqm = area.calcPlanSqm ?? 0;
    if (!planSqm && area.calcWidthM && area.calcLengthM)
        planSqm = area.calcWidthM * area.calcLengthM;
    return planSqm * rafterPitchFactor(area.calcPitchDegrees ?? 0);
}
function totalRoofArea(areas) {
    return areas.reduce((sum, a) => sum + (a.computedSqm ?? computeRoofArea(a)), 0);
}
/**
 * Computes material cost for a component given its purchasing strategy.
 *
 * - `per_unit`: classic `qty * cost_per_unit` (today's behaviour).
 * - `per_pack_length` / `per_pack_area` / `per_pack_volume`: roll/pack
 *   purchases. Cost = `ceil(qty / pack_size) * pack_price`. Round-up
 *   captures the next purchasable unit. Used when the user buys cable in
 *   20m rolls, underlay in 50m² rolls, or concrete in 5m³ packs.
 * - `per_pack_coverage`: paint-style. `pack_size` is the physical pack
 *   quantity (e.g. 20L) for display only; `pack_coverage_m2` is what the
 *   pack actually covers. Cost = `ceil(area_m2 / pack_coverage_m2) * pack_price`.
 *
 * Returns { cost: 0, packDataMissing: true } for nonsense inputs rather than
 * throwing - the DB ck_component_library_pack_values_positive CHECK already
 * rejects bad data on write, so this is a defensive belt at the math layer.
 * Callers should check `packDataMissing` to warn the user (e.g. ⚠ badge in
 * the quote builder) so quotes don't silently ship with £0 material cost.
 */
function computeMaterialCostByStrategy(args) {
    const { strategy, totalQuantity, materialRate, packPrice, packSize, packCoverageM2 } = args;
    if (totalQuantity <= 0)
        return { cost: 0, packDataMissing: false };
    switch (strategy) {
        case 'per_unit': {
            return { cost: totalQuantity * materialRate, packDataMissing: false };
        }
        case 'per_pack_length':
        case 'per_pack_area':
        case 'per_pack_volume': {
            if (!packPrice || !packSize || packSize <= 0)
                return { cost: 0, packDataMissing: true };
            const packs = Math.ceil(totalQuantity / packSize);
            return { cost: packs * packPrice, packDataMissing: false };
        }
        case 'per_pack_coverage': {
            if (!packPrice || !packCoverageM2 || packCoverageM2 <= 0)
                return { cost: 0, packDataMissing: true };
            const packs = Math.ceil(totalQuantity / packCoverageM2);
            return { cost: packs * packPrice, packDataMissing: false };
        }
    }
}
/**
 * Convenience: returns the number of packs the user will need to buy
 * (useful for UI worked-example strings like "6 × 50m² rolls"). Returns 0
 * for per_unit (the concept doesn't apply) or for missing pack data.
 */
function computePackCount(args) {
    const { strategy, totalQuantity, packSize, packCoverageM2 } = args;
    if (totalQuantity <= 0)
        return 0;
    switch (strategy) {
        case 'per_unit':
            return 0;
        case 'per_pack_length':
        case 'per_pack_area':
        case 'per_pack_volume':
            if (!packSize || packSize <= 0)
                return 0;
            return Math.ceil(totalQuantity / packSize);
        case 'per_pack_coverage':
            if (!packCoverageM2 || packCoverageM2 <= 0)
                return 0;
            return Math.ceil(totalQuantity / packCoverageM2);
    }
}
// ─── Quote Totals ────────────────────────────────────
// Uses material_cost and labour_cost already stored on components (entry-based)
// The per-component pricing_strategy switch lives in computeMaterialCostByStrategy
// above; recalc helpers call it before writing material_cost back to the row.
function computeQuoteTotals(components, context) {
    const totalMaterials = components.reduce((sum, c) => sum + (c.materialCost ?? 0), 0);
    const totalLabour = components.reduce((sum, c) => sum + (c.labourCost ?? 0), 0);
    const subtotal = totalMaterials + totalLabour;
    const materialMargin = totalMaterials * ((context.materialMarginPct || 0) / 100);
    const labourMargin = totalLabour * ((context.labourMarginPct || 0) / 100);
    const subtotalWithMargins = subtotal + materialMargin + labourMargin;
    const tax = subtotalWithMargins * ((context.taxRate || 0) / 100);
    return { totalMaterials, totalLabour, subtotal, materialMargin, labourMargin, subtotalWithMargins, tax, grandTotal: subtotalWithMargins + tax };
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/lib/measurements/conversions.ts":function(require,module,exports){
"use strict";
// Conversion utilities for metric / imperial measurement systems.
// All database values are stored in METRIC (m, m²) as the canonical form.
//
// Imperial comes in two area flavours users can pick from:
//   - Square Feet (ft²)         used by US roofers
//   - Roofing Squares (RS)      used by NZ/AU/UK roofers; 1 RS = 100 ft² = 9.2903 m²
// Linear is always in feet for both Imperial flavours.
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertLinear = convertLinear;
exports.convertLinearRate = convertLinearRate;
exports.convertLinearToMetric = convertLinearToMetric;
exports.convertAreaFt2 = convertAreaFt2;
exports.convertAreaFt2Rate = convertAreaFt2Rate;
exports.convertAreaFt2ToMetric = convertAreaFt2ToMetric;
exports.convertArea = convertArea;
exports.convertAreaRs = convertAreaRs;
exports.convertAreaRate = convertAreaRate;
exports.convertAreaToMetric = convertAreaToMetric;
exports.convertVolumeFt3 = convertVolumeFt3;
exports.convertVolumeFt3ToMetric = convertVolumeFt3ToMetric;
exports.volumeInputToMetric = volumeInputToMetric;
exports.mmToInches = mmToInches;
exports.inchesToMm = inchesToMm;
exports.linearInputToMetric = linearInputToMetric;
exports.areaInputToMetric = areaInputToMetric;
const types_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/types.ts");
// -- Conversion constants ----------------------------------------------------
const M_TO_FT = 3.28084;
const SQM_TO_FT2 = 10.7639;
const SQM_TO_RS = 0.107639; // 1 m² = 0.107639 RS  (= 1/9.2903)
const MM_PER_INCH = 25.4; // exact by definition (since 1959)
// -- Linear (m -> ft) --------------------------------------------------------
/** Display a linear measurement (stored in meters) in feet, 2dp. */
function convertLinear(meters) {
    return Number((meters * M_TO_FT).toFixed(2));
}
/** Convert a linear rate ($/m -> $/ft), 2dp. */
function convertLinearRate(ratePerMeter) {
    return Number((ratePerMeter / M_TO_FT).toFixed(2));
}
/** Customer typed feet, store as meters. */
function convertLinearToMetric(feet) {
    return feet / M_TO_FT;
}
// -- Area (m² -> ft²) --------------------------------------------------------
/** Display an area (stored in m²) in square feet, 2dp. */
function convertAreaFt2(sqm) {
    return Number((sqm * SQM_TO_FT2).toFixed(2));
}
/** Convert an area rate ($/m² -> $/ft²), 4dp (rates can be small per ft²). */
function convertAreaFt2Rate(ratePerSqm) {
    return Number((ratePerSqm / SQM_TO_FT2).toFixed(4));
}
/** Customer typed ft², store as m². */
function convertAreaFt2ToMetric(ft2) {
    return ft2 / SQM_TO_FT2;
}
// -- Area (m² -> Roofing Squares) --------------------------------------------
/** Display an area (stored in m²) in Roofing Squares, 3dp. Returned as string for backwards compat. */
function convertArea(sqm) {
    return (sqm * SQM_TO_RS).toFixed(3);
}
/** Numeric variant of convertArea for callers that want to keep doing math. */
function convertAreaRs(sqm) {
    return Number((sqm * SQM_TO_RS).toFixed(3));
}
/** Convert an area rate ($/m² -> $/RS), 2dp. */
function convertAreaRate(ratePerSqm) {
    return Number((ratePerSqm / SQM_TO_RS).toFixed(2));
}
/** Customer typed RS, store as m². */
function convertAreaToMetric(roofingSquares) {
    return roofingSquares / SQM_TO_RS;
}
// -- Volume (m³ -> ft³) ------------------------------------------------------
const SQM_TO_CUBIC_FT = SQM_TO_FT2 * M_TO_FT; // m³ -> ft³  (≈35.3147)
/** Display a volume (stored in m³) in cubic feet, 2dp. */
function convertVolumeFt3(cubicM) {
    return Number((cubicM * SQM_TO_CUBIC_FT).toFixed(2));
}
/** Customer typed ft³, store as m³. */
function convertVolumeFt3ToMetric(ft3) {
    return ft3 / SQM_TO_CUBIC_FT;
}
/**
 * Convert a volume value typed by the user (in their measurement system) into
 * canonical metric storage (m³). Imperial users both flavours use ft³.
 */
function volumeInputToMetric(input, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return input;
    return convertVolumeFt3ToMetric(input);
}
// -- Small-unit (mm ↔ in) ----------------------------------------------------
//
// Used by the flashings drawing tool, where canvas measurements are stored
// in mm but Imperial users want to see and enter inches. 1 inch = 25.4 mm
// exactly (international inch since 1959).
/** Display a mm value in inches, 2dp. */
function mmToInches(mm) {
    return Number((mm / MM_PER_INCH).toFixed(2));
}
/** Customer typed inches, store as mm. Keeps full precision; callers may round. */
function inchesToMm(inches) {
    return inches * MM_PER_INCH;
}
// -- Polymorphic helpers (recommended for new call sites) --------------------
/**
 * Convert a linear value typed by the user (in their measurement system) into
 * canonical metric storage (meters).
 */
function linearInputToMetric(input, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return input;
    return convertLinearToMetric(input);
}
/**
 * Convert an area value typed by the user (in their measurement system) into
 * canonical metric storage (m²). Handles ft² vs Roofing Squares.
 */
function areaInputToMetric(input, system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    if (norm === 'metric')
        return input;
    if (norm === 'imperial_ft')
        return convertAreaFt2ToMetric(input);
    return convertAreaToMetric(input); // imperial_rs
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/ComponentTestPanel.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentTestPanel = ComponentTestPanel;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const types_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/types.ts");
const currencies_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/currency/currencies.ts");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
const QcField_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcField.tsx");
const QcIcon_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx");
const componentTest_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/componentTest.ts");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/pricing-activation.css");
const number = (value) => new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value);
function ComponentTestPanel({ draft, measurementSystem, currency, onClose, onCalculated, focusOnMount = false }) {
    const id = (0, react_1.useId)();
    const firstInput = (0, react_1.useRef)(null);
    const [values, setValues] = (0, react_1.useState)(['']);
    const [system, setSystem] = (0, react_1.useState)(measurementSystem);
    const [basis, setBasis] = (0, react_1.useState)('surface');
    const [pitch, setPitch] = (0, react_1.useState)('');
    const [attempted, setAttempted] = (0, react_1.useState)(false);
    const inputDim = (0, componentTest_1.inputDimension)(draft.measurementType);
    const pricedDim = (0, componentTest_1.pricedDimension)(draft.measurementType);
    const inputUnit = (0, componentTest_1.unitForDimension)(inputDim, system, draft.timeUnit);
    const outputUnit = (0, componentTest_1.unitForDimension)(pricedDim, system, draft.timeUnit);
    const costUnit = (0, componentTest_1.canonicalUnit)(draft.measurementType, draft.timeUnit);
    const result = attempted ? (0, componentTest_1.calculateComponentTest)(draft, { values, system, basis, pitch }) : null;
    const errors = result && !result.ok ? result.errors : {};
    const total = result?.ok ? result.result : null;
    const money = (value) => (0, currencies_1.formatCurrency)(value, currency);
    const qty = (value) => `${number((0, componentTest_1.displayQuantity)(value, pricedDim, system))} ${outputUnit}`;
    const inputLabel = inputDim === 'length' ? 'Test length' : inputDim === 'area' ? 'Test area'
        : inputDim === 'volume' ? 'Test volume' : inputDim === 'time' ? 'Test time' : 'Test quantity';
    (0, react_1.useEffect)(() => { if (focusOnMount)
        firstInput.current?.focus({ preventScroll: true }); }, [focusOnMount]);
    function calculate() {
        setAttempted(true);
        const outcome = (0, componentTest_1.calculateComponentTest)(draft, { values, system, basis, pitch });
        if (outcome.ok)
            onCalculated?.();
    }
    // Explicit non-existent form owner detaches test controls from an ancestor
    // component form. A bad sample must NEVER block Save via native validity.
    // No test controls have a name; Enter is handled locally below.
    return (0, jsx_runtime_1.jsxs)("aside", { className: "qc-component-test", "aria-labelledby": `${id}-title`, "data-qc-component": "C70", children: [(0, jsx_runtime_1.jsxs)("header", { className: "qc-pricing-heading", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-eyebrow", children: "Try a measurement" }), (0, jsx_runtime_1.jsx)("h3", { id: `${id}-title`, children: "Test component" })] }), onClose && (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { className: "qc-icon-button", "aria-label": "Close component test", onClick: onClose, children: (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "close" }) })] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-pricing-muted", children: "Uses the settings in this editor. Nothing is saved and no quote is created." }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-test-inputs", onKeyDown: event => {
                    // Enter calculates, never submits the parent component form.
                    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                        event.preventDefault();
                        calculate();
                    }
                }, children: [inputDim !== 'fixed' && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [['length', 'area', 'volume'].includes(inputDim) && (0, jsx_runtime_1.jsx)(QcField_1.QcField, { label: "Test measurement units", htmlFor: `${id}-system`, children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { form: `${id}-test-only`, id: `${id}-system`, value: (0, types_1.normalizeMeasurementSystem)(system), onChange: e => {
                                        // Do not reinterpret 120 ft² as 120 m² without asking for a new value.
                                        setSystem(e.target.value);
                                        setValues(['']);
                                        setAttempted(false);
                                    }, children: [(0, jsx_runtime_1.jsx)("option", { value: "metric", children: "Metric" }), (0, jsx_runtime_1.jsx)("option", { value: "imperial_ft", children: "Feet / square feet" }), (0, jsx_runtime_1.jsx)("option", { value: "imperial_rs", children: "Feet / roofing squares" })] }) }), values.map((value, index) => (0, jsx_runtime_1.jsxs)("div", { className: "qc-test-measure-row", children: [(0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-value-${index}`, label: `${inputLabel}${values.length > 1 ? ` ${index + 1}` : ''} (${inputUnit})`, children: (0, jsx_runtime_1.jsx)(QcField_1.QcInput, { form: `${id}-test-only`, ref: index === 0 ? firstInput : undefined, id: `${id}-value-${index}`, type: "number", min: "0", step: "any", inputMode: "decimal", value: value, placeholder: inputDim === 'quantity' ? 'e.g. 5' : 'e.g. 120', "aria-invalid": !!errors[`value-${index}`], "aria-describedby": errors[`value-${index}`] ? `${id}-errors` : undefined, onChange: e => setValues(previous => previous.map((v, i) => i === index ? e.target.value : v)) }) }), values.length > 1 && (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { "aria-label": `Remove test measurement ${index + 1}`, className: "qc-icon-button", onClick: () => setValues(previous => previous.filter((_, i) => i !== index)), children: (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "trash" }) })] }, index)), (inputDim === 'length' || draft.measurementType.startsWith('multi_')) && (0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { size: "sm", onClick: () => setValues(previous => [...previous, '']), children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "plus" }), " ", inputDim === 'length' ? 'Add another length' : 'Add another measurement'] }), draft.measurementType.includes('freestyle') && (0, jsx_runtime_1.jsx)("p", { className: "qc-pricing-muted", children: "Enter the area you have already worked out from the length and height." }), draft.measurementType === 'volume_3d' && (0, jsx_runtime_1.jsx)("p", { className: "qc-pricing-muted", children: "Enter the volume you have already worked out from length, width and depth." })] }), inputDim === 'fixed' && (0, jsx_runtime_1.jsx)("p", { className: "qc-pricing-callout", children: "This test uses one fixed charge. No measurement is needed." }), draft.pitchType !== 'none' && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-basis`, label: "Measurement basis", help: "Already measured on the slope? Do not apply pitch a second time.", children: (0, jsx_runtime_1.jsxs)(QcField_1.QcSelect, { form: `${id}-test-only`, id: `${id}-basis`, value: basis, onChange: e => setBasis(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "surface", children: "Already measured / on the slope" }), (0, jsx_runtime_1.jsx)("option", { value: "plan", children: "Plan measurement - apply pitch" })] }) }), basis === 'plan' && (0, jsx_runtime_1.jsx)(QcField_1.QcField, { htmlFor: `${id}-pitch`, label: "Pitch (degrees)", children: (0, jsx_runtime_1.jsx)(QcField_1.QcInput, { form: `${id}-test-only`, id: `${id}-pitch`, type: "number", inputMode: "decimal", step: "any", min: "0", max: "89.99", placeholder: "e.g. 25", value: pitch, "aria-invalid": !!errors.pitch, onChange: e => setPitch(e.target.value) }) })] }), (0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { variant: "secondary", onClick: calculate, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "pricing" }), attempted ? 'Calculate again' : 'Calculate'] })] }), result && !result.ok && (0, jsx_runtime_1.jsxs)("div", { id: `${id}-errors`, className: "qc-pricing-error", role: "status", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Check before calculating" }), (0, jsx_runtime_1.jsx)("ul", { children: Object.values(result.errors).map(message => (0, jsx_runtime_1.jsx)("li", { children: message }, message)) }), (0, jsx_runtime_1.jsx)("p", { children: "Enter 0 for an intentional zero cost. Empty costs are not assumed to be free." })] }), !attempted && (0, jsx_runtime_1.jsxs)("div", { className: "qc-test-empty", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "measure" }), (0, jsx_runtime_1.jsx)("p", { children: "Enter a measurement to see materials, labour and allowances working together." })] }), total && (0, jsx_runtime_1.jsxs)("div", { className: "qc-test-result", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-test-total", "aria-live": "polite", "aria-atomic": "true", children: [(0, jsx_runtime_1.jsx)("span", { children: "Component cost" }), (0, jsx_runtime_1.jsx)("strong", { children: money(total.total) }), (0, jsx_runtime_1.jsxs)("small", { children: [currency, " \u00B7 before quote margins and tax"] })] }), (0, jsx_runtime_1.jsxs)("dl", { className: "qc-test-breakdown", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: total.entryCount > 1 ? `${total.entryCount} measurements entered` : 'Measurement entered' }), (0, jsx_runtime_1.jsxs)("dd", { children: [number(total.entered), " ", inputUnit] })] }), inputDim !== pricedDim && (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("dt", { children: ["After preset ", inputDim === 'length' ? 'height' : 'depth'] }), (0, jsx_runtime_1.jsx)("dd", { children: qty(total.measured) })] }), total.pitchApplied && (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("dt", { children: ["After ", draft.pitchType === 'valley_hip' ? 'hip/valley' : 'rafter', " pitch (", pitch, "\u00B0)"] }), (0, jsx_runtime_1.jsx)("dd", { children: qty(total.afterPitch) })] }), draft.wasteType !== 'none' && (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("dt", { children: ["Waste added", draft.wasteType === 'percent' ? ` (${draft.wasteAmount}%)` : ''] }), (0, jsx_runtime_1.jsx)("dd", { children: qty(total.wasteAdded) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-test-emphasis", children: [(0, jsx_runtime_1.jsx)("dt", { children: "Required quantity" }), (0, jsx_runtime_1.jsx)("dd", { children: qty(total.required) })] }), total.purchased !== null && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: "Whole packs to buy" }), (0, jsx_runtime_1.jsx)("dd", { children: number(total.packs) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: "Quantity purchased" }), (0, jsx_runtime_1.jsx)("dd", { children: qty(total.purchased) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: "Spare after allowance" }), (0, jsx_runtime_1.jsx)("dd", { children: qty(total.spare ?? 0) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-test-emphasis", children: [(0, jsx_runtime_1.jsx)("dt", { children: "Materials" }), (0, jsx_runtime_1.jsx)("dd", { children: money(total.materialCost) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("dt", { children: "Labour" }), (0, jsx_runtime_1.jsx)("dd", { children: money(total.labourCost) })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "qc-pricing-muted", children: [total.effectiveCost !== null && `Effective cost: ${money(total.effectiveCost)} per entered ${inputUnit}. `, total.purchased !== null && 'Whole-pack rounding can make a small job cost more per unit.'] }), (0, jsx_runtime_1.jsxs)("details", { className: "qc-pricing-details", children: [(0, jsx_runtime_1.jsx)("summary", { children: "How this was calculated" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { children: draft.strategy === 'per_unit'
                                            ? `Materials: ${number(total.required)} ${costUnit} × ${money(Number(draft.materialRate))}.`
                                            : `Materials: ${number(total.packs)} whole packs × ${money(Number(draft.packPrice))}.` }), (0, jsx_runtime_1.jsxs)("p", { children: ["Labour: ", number(total.required), " ", costUnit, " \u00D7 ", money(Number(draft.labourRate)), ". Labour uses the quantity after pitch and waste, not rounded-up pack coverage."] }), (draft.wasteType === 'fixed' || draft.wasteType === 'fixed_per_segment') && (0, jsx_runtime_1.jsx)("p", { children: "The fixed allowance is applied to each entered measurement in this manual-entry test. Takeoff keeps its existing segment rules." }), (0, jsx_runtime_1.jsx)("p", { children: "Uses the quote calculation helpers with no job overrides, margins or tax. This explains the rules; it does not verify that your prices are right for your business." })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "qc-test-live", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "check" }), " Valid changes update this result immediately."] })] })] });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/lib/currency/currencies.ts":function(require,module,exports){
"use strict";
// Currency definitions and formatting utilities
// ISO 4217 currency codes with display metadata
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY_GROUPS = exports.ALL_CURRENCY_CODES = exports.OTHER_CURRENCIES = exports.DOLLAR_CURRENCIES = exports.CURRENCIES = void 0;
exports.formatCurrency = formatCurrency;
exports.getCurrencySymbol = getCurrencySymbol;
exports.getCurrencyName = getCurrencyName;
exports.formatCurrencyWithCode = formatCurrencyWithCode;
exports.getEffectiveCurrency = getEffectiveCurrency;
// =============================================================================
// Currency Definitions
// =============================================================================
exports.CURRENCIES = {
    // Dollar variants (all use $ symbol)
    NZD: {
        code: 'NZD',
        symbol: '$',
        name: 'New Zealand Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    AUD: {
        code: 'AUD',
        symbol: '$',
        name: 'Australian Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    USD: {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    CAD: {
        code: 'CAD',
        symbol: '$',
        name: 'Canadian Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    SGD: {
        code: 'SGD',
        symbol: '$',
        name: 'Singapore Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    HKD: {
        code: 'HKD',
        symbol: '$',
        name: 'Hong Kong Dollar',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    // Major currencies (non-dollar)
    GBP: {
        code: 'GBP',
        symbol: '£',
        name: 'British Pound',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    EUR: {
        code: 'EUR',
        symbol: '€',
        name: 'Euro',
        symbolPosition: 'before',
        decimalSeparator: ',',
        thousandsSeparator: '.',
        decimals: 2,
    },
    JPY: {
        code: 'JPY',
        symbol: '¥',
        name: 'Japanese Yen',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 0, // Yen has no decimal subdivision
    },
    CNY: {
        code: 'CNY',
        symbol: '¥',
        name: 'Chinese Yuan',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    CHF: {
        code: 'CHF',
        symbol: 'CHF',
        name: 'Swiss Franc',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
    INR: {
        code: 'INR',
        symbol: '₹',
        name: 'Indian Rupee',
        symbolPosition: 'before',
        decimalSeparator: '.',
        thousandsSeparator: ',',
        decimals: 2,
    },
};
// =============================================================================
// Currency Lists for UI
// =============================================================================
exports.DOLLAR_CURRENCIES = ['NZD', 'AUD', 'USD', 'CAD', 'SGD', 'HKD'];
exports.OTHER_CURRENCIES = ['GBP', 'EUR', 'JPY', 'CNY', 'CHF', 'INR'];
exports.ALL_CURRENCY_CODES = [...exports.DOLLAR_CURRENCIES, ...exports.OTHER_CURRENCIES];
// Grouped for dropdown UI
exports.CURRENCY_GROUPS = [
    {
        label: 'Dollar Currencies',
        currencies: exports.DOLLAR_CURRENCIES.map(code => exports.CURRENCIES[code]),
    },
    {
        label: 'Other Currencies',
        currencies: exports.OTHER_CURRENCIES.map(code => exports.CURRENCIES[code]),
    },
];
// =============================================================================
// Formatting Functions
// =============================================================================
/**
 * Format a number as currency
 * @param amount - Raw number (e.g., 1234.56)
 * @param currencyCode - ISO 4217 code (e.g., 'NZD')
 * @returns Formatted string (e.g., '$1,234.56')
 */
function formatCurrency(amount, currencyCode) {
    const currency = exports.CURRENCIES[currencyCode];
    if (!currency) {
        // Fallback: use NZD formatting if currency not found
        console.warn(`Unknown currency code: ${currencyCode}, falling back to NZD`);
        return formatCurrency(amount, 'NZD');
    }
    // Round to correct decimal places
    const rounded = Math.round(amount * Math.pow(10, currency.decimals)) / Math.pow(10, currency.decimals);
    // Format integer and decimal parts
    const [integerPart, decimalPart] = rounded.toFixed(currency.decimals).split('.');
    // Add thousands separators
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, currency.thousandsSeparator);
    // Combine with decimal separator
    let formattedNumber = formattedInteger;
    if (currency.decimals > 0) {
        formattedNumber += currency.decimalSeparator + decimalPart;
    }
    // Add currency symbol
    if (currency.symbolPosition === 'before') {
        return `${currency.symbol}${formattedNumber}`;
    }
    else {
        return `${formattedNumber}${currency.symbol}`;
    }
}
/**
 * Get currency symbol only
 */
function getCurrencySymbol(currencyCode) {
    return exports.CURRENCIES[currencyCode]?.symbol || '$';
}
/**
 * Get currency name
 */
function getCurrencyName(currencyCode) {
    return exports.CURRENCIES[currencyCode]?.name || currencyCode;
}
/**
 * Format currency with code suffix (for disambiguation)
 * @example formatCurrencyWithCode(1234.56, 'NZD') => '$1,234.56 NZD'
 */
function formatCurrencyWithCode(amount, currencyCode) {
    return `${formatCurrency(amount, currencyCode)} ${currencyCode}`;
}
// =============================================================================
// Helper: Get effective currency (with company fallback)
// =============================================================================
/**
 * Resolve effective currency (quote.currency || company.default_currency)
 * @param quoteCurrency - Quote's currency (can be null)
 * @param companyDefaultCurrency - Company's default currency
 * @returns Effective currency code to use
 */
function getEffectiveCurrency(quoteCurrency, companyDefaultCurrency) {
    return quoteCurrency || companyDefaultCurrency;
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/pricing-activation.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/components/parts/helpers.ts":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PITCH_LABELS = exports.WASTE_LABELS = exports.WASTE_UNIT_LABELS = exports.PRICING_STRATEGY_LABELS = exports.ROOFING_DEFAULT_TYPES = void 0;
exports.buildMeasurementLabels = buildMeasurementLabels;
exports.allowedStrategiesFor = allowedStrategiesFor;
const types_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/types.ts");
function buildMeasurementLabels(system) {
    const norm = (0, types_1.normalizeMeasurementSystem)(system);
    const areaUnit = norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
    const linealUnit = norm === 'metric' ? 'm' : 'ft';
    const volumeUnit = norm === 'metric' ? 'm³' : 'ft³';
    return {
        area: `Area (${areaUnit})`,
        lineal: `Linear: Single (${linealUnit})`,
        // `linear` is the legacy enum value (zero rows in production). Kept in
        // the lookup so an unmigrated row would still render a label rather
        // than crashing; new code uses `lineal`.
        linear: `Linear: Single (${linealUnit})`,
        quantity: 'Quantity',
        fixed: 'Fixed',
        // Phase 2 (Generic Trades) additions. Visible in the dropdown only when
        // NEXT_PUBLIC_GENERIC_TRADES_V1 is on; otherwise filtered out below.
        length_x_height: `Length x Height: Single (${areaUnit})`,
        volume: `Volume - Preset Depth (${volumeUnit})`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        volume_3d: `Volume (${volumeUnit})`,
        hours_days: 'Hours / Days',
        count: 'Count (each)',
        curved_line: `Curved Line (${linealUnit})`,
        irregular_area: `Irregular Area (${areaUnit})`,
        multi_lineal: `Linear: Multi-Length (${linealUnit})`,
        multi_lineal_lxh: `Length x Height: Multi-Length (${areaUnit})`,
        length_x_height_freestyle: `Length x Height: Custom (${areaUnit})`,
        multi_lineal_lxh_freestyle: `Length x Height: Multi-Length Custom (${areaUnit})`,
    };
}
/** Measurement types shown when the generic-trades flag is off. */
exports.ROOFING_DEFAULT_TYPES = new Set([
    'area',
    'lineal',
    'quantity',
    'fixed',
]);
exports.PRICING_STRATEGY_LABELS = {
    per_unit: 'Per unit (default)',
    per_pack_length: 'Fixed Quantity (e.g. 20m cable rolls)',
    per_pack_area: 'Fixed Quantity (e.g. 50m² tile bundles)',
    // per_pack_coverage retained for legacy components only; hidden from new
    // components via allowedStrategiesFor.
    per_pack_coverage: 'Fixed Quantity (coverage - legacy)',
    per_pack_volume: 'Fixed Quantity (e.g. 5m³ concrete units),'
};
exports.WASTE_UNIT_LABELS = {
    percent: 'Percentage (% of measured)',
    flat: 'Flat \u2014 total length (added once to total)',
    flat_per_segment: 'Flat \u2014 per segment (added per point-to-point length)',
};
/** Which pricing strategies are allowed for which measurement types.
 *  Mirrors ck_component_library_strategy_compat from the Phase 2 migration. */
function allowedStrategiesFor(mt) {
    // per_unit always allowed.
    const base = ['per_unit'];
    if (['lineal', 'linear', 'multi_lineal', 'curved_line'].includes(mt)) {
        base.push('per_pack_length');
    }
    if (['area', 'length_x_height', 'length_x_height_freestyle', 'irregular_area', 'multi_lineal_lxh', 'multi_lineal_lxh_freestyle'].includes(mt)) {
        // per_pack_coverage removed from new components; enum retained for legacy.
        base.push('per_pack_area');
    }
    if (mt === 'volume' || mt === 'volume_3d') {
        base.push('per_pack_volume');
    }
    return base;
}
exports.WASTE_LABELS = {
    none: 'None',
    percent: 'Percentage',
    fixed: 'Fixed (total)',
    fixed_per_segment: 'Fixed (per segment)',
};
exports.PITCH_LABELS = {
    none: 'None',
    rafter: 'Rafter Pitch',
    valley_hip: 'Valley/Hip Pitch',
};

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/PricingIntroduction.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingIntroduction = PricingIntroduction;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = require("next/link");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
const QcIcon_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx");
const actions_1 = require("@actions");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/pricing-activation.css");
/** Personal guidance preference only. Never a business-price verification flag. */
function PricingIntroduction({ open, onOpen, onDismiss, hasComponents, tested, created, ownTested, workspaceSlug, onCreate, onChoose, onTestCreated }) {
    const [pending, setPending] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        const oldValue = document.body.dataset.copilotSuppress;
        document.body.dataset.copilotSuppress = '1';
        return () => {
            if (oldValue === undefined)
                delete document.body.dataset.copilotSuppress;
            else
                document.body.dataset.copilotSuppress = oldValue;
        };
    }, [open]);
    async function dismiss() {
        if (pending)
            return;
        setPending(true);
        setError('');
        try {
            const result = await (0, actions_1.markComponentsIntroSeen)();
            if (result.ok)
                onDismiss();
            else
                setError('Could not remember your preference. You can retry or hide this for this visit.');
        }
        catch {
            setError('Could not remember your preference. You can retry or hide this for this visit.');
        }
        finally {
            setPending(false);
        }
    }
    if (!open)
        return (0, jsx_runtime_1.jsx)("div", { className: "qc-pricing-help-row", children: (0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { size: "sm", onClick: onOpen, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "help" }), " How Smart Components work"] }) });
    return (0, jsx_runtime_1.jsxs)("section", { className: "qc-pricing-intro", "aria-labelledby": "qc-pricing-intro-title", "data-qc-component": "C71", children: [(0, jsx_runtime_1.jsxs)("header", { className: "qc-pricing-heading", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-eyebrow", children: "Set up once. Reuse on every job." }), (0, jsx_runtime_1.jsx)("h2", { id: "qc-pricing-intro-title", children: "Make QuoteCore use your prices" })] }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { pending: pending, onClick: () => { void dismiss(); }, "aria-label": "Hide pricing introduction", children: "Hide guide" })] }), (0, jsx_runtime_1.jsx)("p", { children: "A Smart Component is like a reusable spreadsheet row: a name, material and labour costs, plus rules for measurement, purchasing and waste." }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-learning-steps", children: [(0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-pricing-step-number", children: tested ? (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "check" }) : '1' }), (0, jsx_runtime_1.jsx)("h3", { children: hasComponents ? 'Test something familiar' : 'Start with one useful item' }), (0, jsx_runtime_1.jsx)("p", { children: hasComponents ? 'Open a component below, choose Test component and enter a length, area or quantity. Change a setting to see its effect.' : 'Your library is empty. Create a product or service you know, enter its costs and test a measurement.' }), (0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { variant: tested ? 'ghost' : 'secondary', onClick: hasComponents ? onChoose : onCreate, children: [hasComponents ? 'Choose a component' : 'Create a component', (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] }), (0, jsx_runtime_1.jsxs)("section", { children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-pricing-step-number", children: created && ownTested ? (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "check" }) : '2' }), (0, jsx_runtime_1.jsx)("h3", { children: "Make your own, then test it" }), (0, jsx_runtime_1.jsx)("p", { children: "Use your business costs. Start from scratch or use an open component's settings as a starting point. Test, check and save." }), (0, jsx_runtime_1.jsxs)(QcButton_1.QcButton, { variant: tested && !created ? 'secondary' : 'ghost', onClick: created ? onTestCreated : onCreate, children: [created ? 'Test your saved component' : 'Create your own', (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "qc-pricing-example-warning", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "info" }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Starter settings are examples, not recommended prices." }), " Replace their costs and check every applicable rule before using them in a real quote. Components already configured by your company may be ready to use."] })] }), created && ownTested && (0, jsx_runtime_1.jsxs)("div", { className: "qc-pricing-next", children: [(0, jsx_runtime_1.jsx)("span", { children: "You've created and tested a component in this visit. Add the others you need for a real job." }), (0, jsx_runtime_1.jsxs)(link_1.default, { prefetch: false, href: `/${workspaceSlug}/quotes/new`, className: "qc-button", "data-qc-variant": "primary", children: ["Price a job", (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-pricing-muted", children: "These checkmarks describe this visit, not a verification of your prices. Catalogue import is available below when you have a price list." }), error && (0, jsx_runtime_1.jsxs)("p", { className: "qc-pricing-error", role: "status", children: [error, " ", (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { size: "sm", onClick: onDismiss, children: "Hide for now" })] })] });
}

},"next/link":function(require,module,exports){
const R=require('react');exports.default=R.forwardRef(function Link({href,prefetch,replace,scroll,...props},ref){return R.createElement('a',{...props,href:typeof href==='string'?href:'#',ref})});
},"@actions":function(require,module,exports){
const later=async value=>{await new Promise(r=>setTimeout(r,window.fixtureDelay||0));return value};
exports.markComponentsIntroSeen=async()=>{window.fixtureCalls.push({kind:'introDismiss'});return {ok:!window.fixtureFail}};
exports.createComponent=async input=>{window.fixtureCalls.push({kind:'create',input});if(window.fixtureFail)return {ok:false,code:'internal_error',message:'Fixture save failure'};const data={...input,id:'created-'+Date.now(),is_active:!window.fixtureCap};return later({ok:true,data,activeStatus:window.fixtureCap?'inactive':'active',activeCount:window.fixtureCap?2:3,componentLimit:30})};
exports.updateComponent=async(id,input)=>{window.fixtureCalls.push({kind:'update',id,input});if(window.fixtureFail)throw Error('Fixture save failure');return later({...window.fixtureComponents.find(c=>c.id===id),...input,id})};
exports.deleteComponent=async id=>{window.fixtureCalls.push({kind:'delete',id});if(window.fixtureFail)throw Error('Fixture delete failure')};
exports.createComponentCollection=async name=>({id:'lib-new',name,is_bootstrap:false});exports.renameComponentCollection=async()=>{};exports.deleteComponentCollection=async()=>{};exports.dismissComponentEditWarning=async()=>{};exports.updateLibraryVisibility=async()=>{};exports.setComponentActive=async()=>({ok:true,activeCount:3});
},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/workspace/HomeDashboard.tsx":function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeDashboard = HomeDashboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = require("next/link");
const QcIcon_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/workspace/qc-home.css");
/** T01/C48. Read-only dashboard composition. Data is owned by the existing server page. */
function HomeDashboard({ workspaceSlug, firstName, newUser, notificationCount, canCreateQuote, assistantAvailable, measureAction, recentWork, allowPricingInvitation = true }) {
    const base = `/${workspaceSlug}`;
    // Only a successful, empty recent-work read can select the getting-started
    // state. Unknown data and an existing company's jobs never become "new".
    const pricingFirst = allowPricingInvitation && recentWork !== undefined && recentWork.length === 0;
    const resume = recentWork?.[0];
    return (0, jsx_runtime_1.jsxs)("div", { className: "qc-home", "data-qc-ui": "v2", children: [(0, jsx_runtime_1.jsxs)("header", { className: "qc-home-heading", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "qc-eyebrow", children: "Your workspace" }), (0, jsx_runtime_1.jsxs)("h1", { children: ["Welcome ", newUser ? '' : 'back, ', firstName] }), (0, jsx_runtime_1.jsx)("p", { children: "Measure with confidence. Price your work. Send a great quote." })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/tutorials`, prefetch: false, className: "qc-button", "data-qc-variant": "glass", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "help" }), " Tutorials"] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "qc-home-start", "aria-labelledby": "qc-home-start-title", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-home-start-copy", children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-eyebrow", children: pricingFirst ? 'Build your pricing system' : resume ? 'Pick up where you left off' : 'Start something new' }), (0, jsx_runtime_1.jsx)("h2", { id: "qc-home-start-title", children: pricingFirst ? 'Make QuoteCore use your prices' : resume ? 'Continue your work' : 'What are we pricing today?' }), (0, jsx_runtime_1.jsx)("p", { children: pricingFirst
                                    ? 'Open a familiar Smart Component, test a measurement, then enter your own costs. Set up once and reuse your pricing on every job.'
                                    : resume ? `Return to ${resume.title}. Your other jobs and starting options are below.`
                                        : 'Already measured the job? Start a quote. Need quantities first? Open your plan in takeoff.' }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-home-start-actions", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: pricingFirst ? `${base}/components?learn=1` : resume ? resume.href : canCreateQuote ? `${base}/quotes/new` : `${base}/quotes`, prefetch: false, className: "qc-button", "data-qc-variant": "primary", "data-qc-size": "lg", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: pricingFirst ? 'pricing' : resume ? 'quote' : 'plus' }), pricingFirst ? 'Set up your pricing' : resume ? 'Continue this job' : canCreateQuote ? 'New quote' : 'Open quotes', (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] }), (pricingFirst || resume) && (0, jsx_runtime_1.jsx)(link_1.default, { href: canCreateQuote ? `${base}/quotes/new` : `${base}/quotes`, prefetch: false, className: "qc-button", "data-qc-variant": "ghost", children: canCreateQuote ? 'Start a new job' : 'Open quotes' }), (0, jsx_runtime_1.jsx)("div", { className: "qc-home-measure", children: measureAction })] }), pricingFirst && (0, jsx_runtime_1.jsx)("p", { className: "qc-home-pricing-note", children: "Starter rates are examples, not recommended prices. Already using your company's pricing? Go straight to a job." })] }), (0, jsx_runtime_1.jsx)("div", { className: "qc-home-process", "aria-label": pricingFirst ? 'Check a component, make your own, price a job' : 'Measure, price, quote', children: (pricingFirst ? ['pricing', 'library', 'quote'] : ['measure', 'pricing', 'quote']).map((name, index) => (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-home-process-icon", children: (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: name }) }), (0, jsx_runtime_1.jsx)("strong", { children: (pricingFirst ? ['Try one', 'Make your own', 'Price a job'] : ['Measure', 'Price', 'Quote'])[index] }), (0, jsx_runtime_1.jsx)("span", { children: (pricingFirst ? ['Test a familiar item', 'Use your costs', 'Apply measurements'] : ['Capture the job', 'Use your pricing', 'Make it yours'])[index] })] }, name)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-home-grid", children: [(0, jsx_runtime_1.jsxs)("section", { className: "qc-home-work qc-hub-surface", "aria-labelledby": "qc-recent-title", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-section-heading", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "qc-eyebrow", children: "Pick up where you left off" }), (0, jsx_runtime_1.jsx)("h2", { id: "qc-recent-title", children: "Continue your work" })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/quotes`, prefetch: false, className: "qc-text-link", children: ["All quotes ", (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] }), recentWork === undefined ? ((0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/quotes`, prefetch: false, className: "qc-home-resume", children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-hub-icon", children: (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "quote" }) }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Find a job or quote" }), (0, jsx_runtime_1.jsx)("span", { children: "Open your quotes to continue pricing, review a draft or check a customer response." })] }), (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })) : recentWork.length === 0 ? (0, jsx_runtime_1.jsxs)("div", { className: "qc-home-empty", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "quote" }), (0, jsx_runtime_1.jsx)("h3", { children: "Your work will appear here" }), (0, jsx_runtime_1.jsx)("p", { children: "Check your pricing, then start a real job. You can return here to continue it." })] }) : (0, jsx_runtime_1.jsx)("div", { className: "qc-recent-list", children: recentWork.map(work => (0, jsx_runtime_1.jsxs)(link_1.default, { href: work.href, prefetch: false, className: "qc-recent-row", children: [(0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: work.title }), (0, jsx_runtime_1.jsxs)("small", { children: [work.customer, " \u00B7 ", work.quoteNumber] })] }), (0, jsx_runtime_1.jsx)("span", { className: "qc-status", "data-qc-tone": work.statusTone, children: work.statusLabel }), (0, jsx_runtime_1.jsx)("small", { children: work.updatedLabel }), (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "chevron" })] }, work.id)) }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-home-queues", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/material-orders`, prefetch: false, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "orders" }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Orders" }), (0, jsx_runtime_1.jsx)("small", { children: "Materials and suppliers" })] }), (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "chevron" })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/invoices`, prefetch: false, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "invoice" }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Invoices" }), (0, jsx_runtime_1.jsx)("small", { children: "Customer invoices and payments" })] }), (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "chevron" })] })] })] }), (0, jsx_runtime_1.jsxs)("aside", { className: "qc-home-side", children: [(0, jsx_runtime_1.jsxs)("section", { className: "qc-hub-surface", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-section-heading", children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-hub-icon", children: (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "mail" }) }), (0, jsx_runtime_1.jsxs)("span", { className: "qc-status", children: [notificationCount, " notification", notificationCount === 1 ? '' : 's'] })] }), (0, jsx_runtime_1.jsx)("h2", { children: "Keep up with customers" }), (0, jsx_runtime_1.jsx)("p", { children: "Use the bell for recent alerts, or open Message Center for your conversations." }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/inbox`, prefetch: false, className: "qc-text-link", children: ["Open Message Center ", (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "qc-hub-surface", children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-eyebrow", children: "Set up once. Reuse every time." }), (0, jsx_runtime_1.jsx)("h2", { children: "Your pricing library" }), (0, jsx_runtime_1.jsx)("p", { children: "Smart Components keep your material costs, labour rates and pricing rules ready for the next job." }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/components`, prefetch: false, className: "qc-button", "data-qc-variant": "ghost", children: ["Open Pricing Library ", (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "qc-home-bottom", "aria-label": "Resources and support", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/resources`, prefetch: false, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "library" }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Resources & templates" }), (0, jsx_runtime_1.jsx)("small", { children: "Your catalogues, reusable files and document templates" })] }), (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] }), assistantAvailable && (0, jsx_runtime_1.jsxs)(link_1.default, { href: `${base}/assistant`, prefetch: false, children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "assistant" }), (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Ask Smart Assistant" }), (0, jsx_runtime_1.jsx)("small", { children: "Get help with quotes, pricing and your workspace" })] }), (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "arrow" })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-home-roadmap", children: "Job Manager is coming later. For now, each quote has its own job space." })] });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/workspace/qc-home.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/tutorials/WelcomeModal.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeModal = WelcomeModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = require("next/link");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
const QcIcon_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx");
const welcome_actions_1 = require("@welcome");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/pricing-activation.css");
/** Kept under the existing export for compatibility. An inline, optional welcome
 *  replaces the blocking tutorial modal. The existing personal dismissal action
 *  is unchanged; it never means that company prices have been checked. */
function WelcomeModal({ base, firstName, pricingFirst = false }) {
    const [open, setOpen] = (0, react_1.useState)(true);
    const [pending, setPending] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    async function dismiss() {
        if (pending)
            return;
        setPending(true);
        setError('');
        try {
            const result = await (0, welcome_actions_1.dismissWelcomeModal)();
            if (result.ok)
                setOpen(false);
            else
                setError('Could not remember your preference. Retry or hide this for this visit.');
        }
        catch {
            setError('Could not remember your preference. Retry or hide this for this visit.');
        }
        finally {
            setPending(false);
        }
    }
    if (!open)
        return null;
    return (0, jsx_runtime_1.jsxs)("aside", { className: "qc-pricing-welcome", "data-qc-ui": "v2", "aria-label": "Getting started help", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "help" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: pricingFirst ? `New here, ${firstName}? Start with a component you know.` : `Welcome, ${firstName}. Your workspace is ready to explore.` }), (0, jsx_runtime_1.jsx)("p", { children: pricingFirst ? 'The pricing guide shows you how to test an example and create your own.' : 'Check your company’s Pricing Library, continue a job, or use Tutorials whenever you need help.' }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(link_1.default, { prefetch: false, href: `${base}/components?learn=1`, className: "qc-text-link", children: "Pricing guide" }), (0, jsx_runtime_1.jsx)(link_1.default, { prefetch: false, href: `${base}/tutorials`, className: "qc-text-link", children: "Tutorials" })] }), error && (0, jsx_runtime_1.jsxs)("p", { role: "status", children: [error, " ", (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { size: "sm", onClick: () => setOpen(false), children: "Hide for now" })] })] }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { pending: pending, "aria-label": "Dismiss getting started help", onClick: () => { void dismiss(); }, children: (0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "close" }) })] });
}

},"@welcome":function(require,module,exports){
exports.dismissWelcomeModal=async()=>({ok:!window.fixtureFail});
},"/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/components/component-list.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentList = ComponentList;
const jsx_runtime_1 = require("react/jsx-runtime");
const useQcFeedback_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/useQcFeedback.tsx");
const QcActionNotice_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcActionNotice.tsx");
const SmartComponentEditor_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/SmartComponentEditor.tsx");
const PricingIntroduction_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/PricingIntroduction.tsx");
const componentTest_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/componentTest.ts");
const currencies_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/currency/currencies.ts");
const QcLibrary_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcLibrary.tsx");
const QcJourney_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcJourney.tsx");
const react_1 = require("react");
const link_1 = require("next/link");
const actions_1 = require("@actions");
const AddFromCatalogModal_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/components/components/AddFromCatalogModal.tsx");
const UpgradeModal_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/UpgradeModal.tsx");
const labels_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/lib/trades/labels.ts");
const actions_2 = require("@drawings");
const types_1 = require("@restore");
/** Build the radio-button labels that decorate measurement type with the company's preferred unit. */
// F-15: Extracted helpers + sub-components
const helpers_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/components/parts/helpers.ts");
const PublishLibraryModal_1 = require("@publish");
function ComponentList({ initialComponents, workspaceSlug, companyMeasurementSystem = 'metric', companyDefaultTrade = 'roofing', companyCurrency = 'NZD', showPricingIntroduction = false, reviewImported = false, componentCollections = [], componentLimit, componentCount, effectivePlanCode, flashingsFeatureEnabled, subscriptionActive, editWarningDismissed = false, restoreDraftId, highlightComponentId, isSupplier = false, }) {
    const { notify, ask, feedback } = (0, useQcFeedback_1.useQcFeedback)();
    const { notice, showNotice } = (0, QcActionNotice_1.useQcActionNotice)();
    const [learning, setLearning] = (0, react_1.useState)(showPricingIntroduction);
    const [testedInSession, setTestedInSession] = (0, react_1.useState)(false);
    const [createdInSession, setCreatedInSession] = (0, react_1.useState)(false);
    const [ownTested, setOwnTested] = (0, react_1.useState)(false);
    const [draftTested, setDraftTested] = (0, react_1.useState)(false);
    const [lastCreatedId, setLastCreatedId] = (0, react_1.useState)(null);
    const [testOnOpen, setTestOnOpen] = (0, react_1.useState)(false);
    const [testRequest, setTestRequest] = (0, react_1.useState)(0);
    const [editorDirty, setEditorDirty] = (0, react_1.useState)(false);
    const [editorVersion, setEditorVersion] = (0, react_1.useState)(0);
    const [createDefaults, setCreateDefaults] = (0, react_1.useState)(null);
    const editorAnchor = (0, react_1.useRef)(null);
    const [catalogueChanged, setCatalogueChanged] = (0, react_1.useState)(false);
    const MEASUREMENT_LABELS = (0, helpers_1.buildMeasurementLabels)(companyMeasurementSystem);
    // Pitch is shown when the trade requires it (roofing) or opts in optionally
    // (landscaping, concrete, insulation, electrical). pitchOptional trades show
    // the checkbox but do not require a pitch on areas.
    const _tradeLabels = (0, labels_1.getTradeLabels)(companyDefaultTrade);
    const pitchVisible = _tradeLabels.pitchRequired || !!_tradeLabels.pitchOptional;
    const pitchCheckboxLabel = _tradeLabels.pitchCheckboxLabel ?? 'Apply pitch calculation';
    // When true, only Rafter Pitch is offered (no Valley/Hip).
    const pitchHidesValleyHip = !!_tradeLabels.pitchHidesValleyHip;
    // Label for the rafter pitch option - 'Rafter Pitch' for roofing, 'Rise over run' for others.
    const pitchRafterLabel = _tradeLabels.pitchRafterLabel ?? 'Rafter Pitch';
    // Material orders image label - flashings terminology only applies to roofing.
    const isRoofingTrade = companyDefaultTrade === 'roofing';
    // Drawing-library feature label: 'Flashings' for roofing, 'Drawings & Images' for all others.
    const featureLabel = _tradeLabels.featureLabel ?? 'Flashings';
    const featureLabelSingular = _tradeLabels.featureLabelSingular ?? 'Flashing';
    const imageHelperText = isRoofingTrade ? 'Add flashing drawings to use in material order forms' : 'Add images/drawings to use in material order forms';
    const [components, setComponents] = (0, react_1.useState)(initialComponents);
    const [flashings, setFlashings] = (0, react_1.useState)([]);
    const [showForm, setShowForm] = (0, react_1.useState)(false);
    const [upgradeOpen, setUpgradeOpen] = (0, react_1.useState)(false);
    const [flashingsUpgradeOpen, setFlashingsUpgradeOpen] = (0, react_1.useState)(false);
    // Smoke #8 (2026-05-19): subscription-inactive upgrade modal. Mirrors
    // the same pattern in QuotesList.
    const [subBlockedOpen, setSubBlockedOpen] = (0, react_1.useState)(false);
    // Active component allowance tracking. `componentCount` is the server-provided
    // authoritative count; `activeCount` tracks local state for immediate UI feedback.
    // We use the server count as the source of truth and update it after each action.
    const [activeCountState, setActiveCountState] = (0, react_1.useState)(componentCount);
    const atCap = componentLimit !== null && activeCountState >= componentLimit;
    const [activatingId, setActivatingId] = (0, react_1.useState)(null);
    const [editingId, setEditingId] = (0, react_1.useState)(null);
    const [filter, setFilter] = (0, react_1.useState)('all');
    const [measurementFilter, setMeasurementFilter] = (0, react_1.useState)('all');
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    const [saving, setSaving] = (0, react_1.useState)(false);
    // Component collection (library) state
    const [collections, setCollections] = (0, react_1.useState)(componentCollections);
    const [selectedCollectionId, setSelectedCollectionId] = (0, react_1.useState)(componentCollections.find(c => c.is_bootstrap)?.id ?? componentCollections[0]?.id ?? '');
    const [showCreateLibraryModal, setShowCreateLibraryModal] = (0, react_1.useState)(false);
    const [showCatalogModal, setShowCatalogModal] = (0, react_1.useState)(false);
    const [newLibraryName, setNewLibraryName] = (0, react_1.useState)('');
    const [creatingLibrary, setCreatingLibrary] = (0, react_1.useState)(false);
    const [createLibraryError, setCreateLibraryError] = (0, react_1.useState)('');
    const [formError, setFormError] = (0, react_1.useState)(null);
    // Active library filter: '' = All Libraries, otherwise a collection id.
    // Initialise from localStorage so the user's last-set default is applied on landing.
    const LOCAL_KEY = `qc-default-lib-${workspaceSlug}`;
    const [activeLibraryId, setActiveLibraryId] = (0, react_1.useState)(() => {
        if (reviewImported || typeof window === 'undefined')
            return '';
        const saved = localStorage.getItem(LOCAL_KEY);
        // Validate saved id still exists in collections list before applying.
        if (saved && componentCollections.some(c => c.id === saved))
            return saved;
        return '';
    });
    const [defaultLibraryFlash, setDefaultLibraryFlash] = (0, react_1.useState)(null);
    const [savedDefaultLibId, setSavedDefaultLibId] = (0, react_1.useState)(() => {
        if (typeof window === 'undefined')
            return '';
        return localStorage.getItem(LOCAL_KEY) ?? '';
    });
    // Inline rename state
    const [renamingLibraryId, setRenamingLibraryId] = (0, react_1.useState)(null);
    const [renameValue, setRenameValue] = (0, react_1.useState)('');
    const [renaming, setRenaming] = (0, react_1.useState)(false);
    // Delete library state
    const [deletingLibraryId, setDeletingLibraryId] = (0, react_1.useState)(null);
    const [deleteLibraryLoading, setDeleteLibraryLoading] = (0, react_1.useState)(false);
    // Publish library modal (supplier-only)
    const [showPublishModal, setShowPublishModal] = (0, react_1.useState)(null);
    // Form state for dynamic fields
    const [formWasteType, setFormWasteType] = (0, react_1.useState)('none');
    const [formMeasurementType, setFormMeasurementType] = (0, react_1.useState)('area');
    const [formPitchEnabled, setFormPitchEnabled] = (0, react_1.useState)(false);
    const [selectedFlashingId, setSelectedFlashingId] = (0, react_1.useState)('');
    const [assignedFlashings, setAssignedFlashings] = (0, react_1.useState)([]);
    // Phase 6.5 (Generic Trades) form state. Gated behind the client flag
    // NEXT_PUBLIC_GENERIC_TRADES_V1. When off, these fields default to today's
    // behaviour and never render in the UI.
    const genericTradesEnabled = (process.env.NEXT_PUBLIC_GENERIC_TRADES_V1 ?? '').toLowerCase() === 'true';
    const [formHeightMm, setFormHeightMm] = (0, react_1.useState)('');
    const [formDepthMm, setFormDepthMm] = (0, react_1.useState)('');
    const [formHoursUnit, setFormHoursUnit] = (0, react_1.useState)('hr');
    const [formWasteUnit, setFormWasteUnit] = (0, react_1.useState)('percent');
    const [formPricingStrategy, setFormPricingStrategy] = (0, react_1.useState)('per_unit');
    // Calculator draft restore (H-04): pre-fill form from a saved draft
    const [restoredName, setRestoredName] = (0, react_1.useState)('');
    const [restoredMaterialRate, setRestoredMaterialRate] = (0, react_1.useState)('');
    const [restoredLabourRate, setRestoredLabourRate] = (0, react_1.useState)('');
    const [restoredWasteAmount, setRestoredWasteAmount] = (0, react_1.useState)('');
    const [draftConsumed, setDraftConsumed] = (0, react_1.useState)(false);
    // ?created= highlight: glow the freshly created component, then fade.
    const [highlightId, setHighlightId] = (0, react_1.useState)(highlightComponentId ?? null);
    const [formPackPrice, setFormPackPrice] = (0, react_1.useState)('');
    const [formPackSize, setFormPackSize] = (0, react_1.useState)('');
    const [formPackCoverageM2, setFormPackCoverageM2] = (0, react_1.useState)('');
    const [formNotes, setFormNotes] = (0, react_1.useState)('');
    // If user picks a strategy that isn't allowed for the chosen measurement
    // type, snap back to per_unit. Keeps the dropdown honest under rapid
    // measurement-type changes.
    (0, react_1.useEffect)(() => {
        if (!(0, helpers_1.allowedStrategiesFor)(formMeasurementType).includes(formPricingStrategy) &&
            !(formPricingStrategy === 'per_pack_coverage' && (0, helpers_1.allowedStrategiesFor)(formMeasurementType).includes('per_pack_area'))) {
            setFormPricingStrategy('per_unit');
        }
    }, [formMeasurementType, formPricingStrategy]);
    // ?created= highlight: scroll the new component into view, clear the
    // glow after a few seconds, and clean up any leftover signup cookies.
    (0, react_1.useEffect)(() => {
        if (!highlightId)
            return;
        const el = document.getElementById(`component-row-${highlightId}`);
        if (el)
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        for (const name of ['qcp_signup_draft', 'qcp_signup_ref']) {
            document.cookie = `${name}=; path=/; max-age=0`;
            const h = window.location.hostname.toLowerCase();
            if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
                document.cookie = `${name}=; path=/; max-age=0; domain=.quote-core.com`;
            }
        }
        const timer = setTimeout(() => setHighlightId(null), 5000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Load flashings on mount
    (0, react_1.useEffect)(() => {
        async function fetchFlashings() {
            try {
                const data = await (0, actions_2.loadFlashingLibrary)();
                setFlashings(data);
            }
            catch (err) {
                console.error('Failed to load flashings:', err);
            }
        }
        fetchFlashings();
    }, []);
    // Calculator draft restore (H-04): load draft (localStorage fast path,
    // then the server copy - drafts created on the marketing domain are not
    // in this origin's localStorage) and pre-fill the form.
    (0, react_1.useEffect)(() => {
        if (!restoreDraftId || draftConsumed)
            return;
        let cancelled = false;
        (async () => {
            const draft = await (0, types_1.loadCalcDraftAsync)(restoreDraftId);
            if (!draft || cancelled)
                return;
            const draftData = draft.data;
            const spec = draftData.spec;
            if (!spec)
                return;
            // Pre-fill form state
            setFormMeasurementType(spec.measurementType || 'area');
            setFormWasteType(spec.wasteType || 'none');
            setFormPitchEnabled(spec.pitchEnabled ?? false);
            if (spec.pricingStrategy)
                setFormPricingStrategy(spec.pricingStrategy);
            if (spec.packSize)
                setFormPackSize(spec.packSize);
            // Pre-fill text inputs via state (rendered as defaultValue only on first render)
            setRestoredName(spec.name || '');
            setRestoredMaterialRate(spec.pricePerUnit || '');
            setRestoredLabourRate(spec.labourAmount || '');
            setRestoredWasteAmount(spec.wasteValue || '');
            // Open the form
            setShowForm(true);
            setDraftConsumed(true);
            // Clear the signup cookies so the dashboard banner doesn't show again
            // (both host-only and cross-subdomain variants).
            for (const name of ['qcp_signup_draft', 'qcp_signup_ref']) {
                document.cookie = `${name}=; path=/; max-age=0`;
                const h = window.location.hostname.toLowerCase();
                if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) {
                    document.cookie = `${name}=; path=/; max-age=0; domain=.quote-core.com`;
                }
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restoreDraftId]);
    let filtered = filter === 'all' ? components : components.filter((c) => c.component_type === filter);
    // Library filter: when a specific library is selected, show only its components.
    if (activeLibraryId) {
        filtered = filtered.filter(c => c.collection_id === activeLibraryId);
    }
    // Measurement/pitch filter
    if (measurementFilter === 'rafter') {
        filtered = filtered.filter(c => c.default_pitch_type === 'rafter');
    }
    else if (measurementFilter === 'valley_hip') {
        filtered = filtered.filter(c => c.default_pitch_type === 'valley_hip');
    }
    else if (measurementFilter !== 'all') {
        filtered = filtered.filter(c => c.measurement_type === measurementFilter);
    }
    // Search
    if (searchQuery) {
        const s = searchQuery.toLowerCase();
        filtered = filtered.filter(c => c.name.toLowerCase().includes(s));
    }
    // Sort: active components first, then by name.
    filtered = [...filtered].sort((a, b) => {
        const aActive = a.is_active !== false ? 0 : 1;
        const bActive = b.is_active !== false ? 0 : 1;
        if (aActive !== bActive)
            return aActive - bActive;
        return a.name.localeCompare(b.name);
    });
    async function mayLeaveEditor() {
        if (saving)
            return false;
        if (!editorDirty)
            return true;
        return ask({ title: 'Leave unsaved component settings?', description: 'Testing does not save your changes. Keep editing to save them first.', confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true });
    }
    async function startEdit(comp, openTest = false) {
        if (editingId === comp.id) {
            if (openTest)
                setTestRequest(value => value + 1);
            editorAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
            return;
        }
        if (!(await mayLeaveEditor()))
            return;
        setShowForm(false);
        setEditorDirty(false);
        setEditorVersion(value => value + 1);
        setTestOnOpen(openTest);
        setTestRequest(0);
        setEditingId(comp.id);
        setFormError(null);
        setFormMeasurementType(comp.measurement_type);
        setFormWasteType(comp.default_waste_type);
        setFormPitchEnabled(comp.default_pitch_type !== 'none');
        setAssignedFlashings(comp.flashing_ids || []);
        setSelectedFlashingId('');
        // Phase 6.5 (Generic Trades) state - read off the (stale-typed) row.
        const c = comp;
        setFormHeightMm(c.height_value_mm != null ? String(c.height_value_mm) : '');
        setFormDepthMm(c.depth_value_mm != null ? String(c.depth_value_mm) : '');
        setFormWasteUnit(c.waste_unit ?? 'percent');
        setFormPricingStrategy(c.pricing_strategy ?? 'per_unit');
        setFormPackPrice(c.pack_price != null ? String(c.pack_price) : '');
        setFormPackSize(c.pack_size != null ? String(c.pack_size) : '');
        setFormPackCoverageM2(c.pack_coverage_m2 != null ? String(c.pack_coverage_m2) : '');
        setFormNotes(c.notes ?? '');
        // Seed collection dropdown with the component's existing collection, or bootstrap fallback.
        const existingCollectionId = c.collection_id ?? '';
        setSelectedCollectionId(existingCollectionId && collections.some(col => col.id === existingCollectionId)
            ? existingCollectionId
            : collections.find(col => col.is_bootstrap)?.id ?? collections[0]?.id ?? '');
    }
    function cancelEdit() {
        setEditorDirty(false);
        setShowForm(false);
        setEditingId(null);
        setFormError(null);
        setFormWasteType('none');
        setFormMeasurementType('area');
        setFormPitchEnabled(false);
        setAssignedFlashings([]);
        setSelectedFlashingId('');
        setFormNotes('');
    }
    async function handleToggleActive(compId, nextActive) {
        setActivatingId(compId);
        try {
            const result = await (0, actions_1.setComponentActive)(compId, nextActive);
            if (result.ok) {
                // Update local component state
                setComponents(prev => prev.map(c => c.id === compId ? { ...c, is_active: nextActive } : c));
                // Update authoritative count
                setActiveCountState(result.activeCount);
            }
            else if (result.code === 'component_limit_reached') {
                // At cap - open upgrade modal
                setUpgradeOpen(true);
            }
        }
        catch (err) {
            console.error('[toggleActive] failed:', err);
        }
        finally {
            setActivatingId(null);
        }
    }
    function addFlashing() {
        if (!selectedFlashingId)
            return;
        if (assignedFlashings.includes(selectedFlashingId)) {
            setFormError('This image is already assigned. Choose a different image.');
            return;
        }
        setAssignedFlashings(prev => [...prev, selectedFlashingId]);
        setSelectedFlashingId('');
    }
    function removeFlashing(flashingId) {
        setAssignedFlashings(prev => prev.filter(id => id !== flashingId));
    }
    async function handleDeleteLibrary() {
        if (!deletingLibraryId)
            return;
        setDeleteLibraryLoading(true);
        const result = await (0, actions_1.deleteComponentCollection)(deletingLibraryId);
        setDeleteLibraryLoading(false);
        if (!result.ok) {
            await notify(result.message);
            setDeletingLibraryId(null);
            return;
        }
        setCollections(prev => prev.filter(c => c.id !== deletingLibraryId));
        // If the deleted library was active, fall back to the default library.
        if (activeLibraryId === deletingLibraryId) {
            const fallback = collections.find(c => c.is_bootstrap && c.id !== deletingLibraryId);
            setActiveLibraryId(fallback?.id ?? '');
        }
        setDeletingLibraryId(null);
    }
    async function handleRenameLibrary() {
        if (!renamingLibraryId || !renameValue.trim())
            return;
        setRenaming(true);
        const result = await (0, actions_1.renameComponentCollection)(renamingLibraryId, renameValue);
        setRenaming(false);
        if (!result.ok) {
            await notify(result.message);
            return;
        }
        setCollections(prev => prev.map(c => c.id === renamingLibraryId ? { ...c, name: result.name } : c));
        setRenamingLibraryId(null);
        setRenameValue('');
    }
    async function handleCreateLibrary() {
        if (!newLibraryName.trim())
            return;
        setCreatingLibrary(true);
        setCreateLibraryError('');
        const result = await (0, actions_1.createComponentCollection)(newLibraryName);
        setCreatingLibrary(false);
        if (!result.ok) {
            setCreateLibraryError(result.message);
            return;
        }
        const newCollection = { id: result.id, name: result.name, is_bootstrap: false };
        setCollections(prev => [...prev, newCollection]);
        setSelectedCollectionId(result.id);
        setNewLibraryName('');
        setShowCreateLibraryModal(false);
    }
    async function handleCreate(e) {
        e.preventDefault();
        setSaving(true);
        setFormError(null);
        // Suppliers: SKU required for components in published libraries
        if (isSupplier) {
            const activeCol = collections.find(c => c.id === activeLibraryId);
            const isPublishedLib = activeCol?.visibility === 'published';
            const skuVal = new FormData(e.currentTarget).get('sku')?.trim();
            if (isPublishedLib && !skuVal) {
                setFormError('SKU / Product Code is required for components in published supplier libraries.');
                setSaving(false);
                return;
            }
        }
        // Validate per_pack_coverage requires all three pack fields.
        if (formPricingStrategy === 'per_pack_coverage') {
            if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
                setFormError('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
                setSaving(false);
                return;
            }
        }
        const fd = new FormData(e.currentTarget);
        const wasteType = fd.get('default_waste_type');
        const wasteAmountRaw = fd.get('waste_amount') || '0';
        const wasteAmount = Number(wasteAmountRaw) || 0;
        if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
            const decimals = wasteAmountRaw.split('.')[1];
            if (decimals && decimals.length > 2) {
                setFormError('Reduce your decimal places to two or less (e.g. 0.25)');
                setSaving(false);
                return;
            }
        }
        // database.types.ts has not been regenerated since Phase 2's enum
        // extension; the typed measurement_type column still narrows to the
        // 5 legacy values. Cast at the boundary - the DB accepts every value
        // in our MeasurementType union and ck_component_library_strategy_compat
        // catches anything that slips through.
        const input = {
            name: fd.get('name'),
            component_type: fd.get('component_type'),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            measurement_type: fd.get('measurement_type'),
            default_material_rate: Number(fd.get('default_material_rate')) || 0,
            default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            default_waste_type: wasteType,
            default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
            default_waste_fixed: (wasteType === 'fixed' || wasteType === 'fixed_per_segment') ? wasteAmount : 0,
            default_pitch_type: formPitchEnabled ? fd.get('default_pitch_type') : 'none',
            eligible_for_orders: fd.get('eligible_for_orders') === 'on',
            flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
            sku: fd.get('sku')?.trim() || null,
        };
        // Phase 6.5 (Generic Trades) additions. Only attached when the client flag
        // is on, so the existing roofing flow keeps writing the exact same payload
        // shape it always did. Cast the spread because database.types.ts is stale
        // on Phase 2 columns until next typegen.
        const inputWithGenericTrades = genericTradesEnabled
            ? {
                ...input,
                height_value_mm: (formMeasurementType === 'length_x_height' || formMeasurementType === 'multi_lineal_lxh') && formHeightMm
                    ? Number(formHeightMm)
                    : null,
                depth_value_mm: formMeasurementType === 'volume' && formDepthMm
                    ? Number(formDepthMm)
                    : null,
                waste_unit: formWasteUnit,
                pricing_strategy: formPricingStrategy,
                pack_price: formPricingStrategy === 'per_unit' || !formPackPrice ? null : Number(formPackPrice),
                pack_size: formPricingStrategy === 'per_unit' || !formPackSize ? null : Number(formPackSize),
                pack_coverage_m2: formPricingStrategy === 'per_pack_coverage' && formPackCoverageM2
                    ? Number(formPackCoverageM2)
                    : null,
                collection_id: selectedCollectionId || null,
                notes: formNotes.trim() || null,
            }
            : { ...input, collection_id: selectedCollectionId || null, notes: formNotes.trim() || null };
        try {
            const result = await (0, actions_1.createComponent)(inputWithGenericTrades);
            if (!result.ok) {
                if (result.code === 'subscription_inactive') {
                    setSubBlockedOpen(true);
                }
                else {
                    setFormError(result.code === 'internal_error' ? result.message : 'Could not create component.');
                }
                return;
            }
            setComponents((prev) => [...prev, result.data]);
            setEditorDirty(false);
            setCreateDefaults(null);
            setCreatedInSession(true);
            setLastCreatedId(result.data.id);
            setOwnTested(draftTested);
            setDraftTested(false);
            setActiveLibraryId(selectedCollectionId);
            setFilter('all');
            setMeasurementFilter('all');
            setSearchQuery('');
            showNotice({ title: 'Component saved', tone: result.activeStatus === 'inactive' ? 'warning' : 'success', focus: true,
                description: result.activeStatus === 'inactive'
                    ? `${result.data.name} was saved as inactive because your active-component allowance is full. Activate it before using it in quotes.`
                    : `${result.data.name} is saved in your library. Check another component or price a job when your costs are ready.` });
            // Update authoritative active count from the server response.
            setActiveCountState(result.activeCount);
            // If the component was created as inactive (at cap), show a brief message.
            if (result.activeStatus === 'inactive') {
                // Could use a toast here; for now, the inactive badge on the row
                // plus the counter updating is sufficient feedback.
                console.log('[createComponent] Component created as inactive (at cap).');
            }
            setShowForm(false);
            setFormWasteType('none');
            setFormMeasurementType('area');
            setFormPitchEnabled(false);
            setAssignedFlashings([]);
            setSelectedFlashingId('');
            // Reset Phase 6.5 form state too.
            setFormHeightMm('');
            setFormDepthMm('');
            setFormHoursUnit('hr');
            setFormWasteUnit('percent');
            setFormPricingStrategy('per_unit');
            setFormPackPrice('');
            setFormPackSize('');
            setFormPackCoverageM2('');
            setFormNotes('');
            // Clear restored draft values
            setRestoredName('');
            setRestoredMaterialRate('');
            setRestoredLabourRate('');
            setRestoredWasteAmount('');
            // Clear the calculator draft from localStorage after successful import
            if (restoreDraftId) {
                (0, types_1.clearCalcDraft)(restoreDraftId);
            }
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create component');
        }
        finally {
            setSaving(false);
        }
    }
    async function handleUpdate(e, id) {
        e.preventDefault();
        // Suppliers: SKU required for components in published libraries, and cannot be changed once published
        if (isSupplier) {
            const activeCol = collections.find(c => c.id === activeLibraryId);
            const isPublishedLib = activeCol?.visibility === 'published';
            const skuVal = new FormData(e.currentTarget).get('sku')?.trim();
            if (isPublishedLib && !skuVal) {
                setFormError('SKU / Product Code is required for components in published supplier libraries.');
                return;
            }
        }
        // Validate per_pack_coverage requires all three pack fields.
        if (formPricingStrategy === 'per_pack_coverage') {
            if (!formPackPrice || !formPackSize || !formPackCoverageM2) {
                setFormError('Per Coverage Area requires Pack price, Pack size, and Coverage per pack to all be filled in.');
                return;
            }
        }
        const fd = new FormData(e.currentTarget);
        const wasteType = fd.get('default_waste_type');
        const wasteAmountRaw = fd.get('waste_amount') || '0';
        const wasteAmount = Number(wasteAmountRaw) || 0;
        if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
            const decimals = wasteAmountRaw.split('.')[1];
            if (decimals && decimals.length > 2) {
                setFormError('Reduce your decimal places to two or less (e.g. 0.25)');
                return;
            }
        }
        const input = {
            name: fd.get('name'),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            measurement_type: formMeasurementType,
            default_material_rate: Number(fd.get('default_material_rate')) || 0,
            default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            default_waste_type: wasteType,
            default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
            default_waste_fixed: (wasteType === 'fixed' || wasteType === 'fixed_per_segment') ? wasteAmount : 0,
            default_pitch_type: formPitchEnabled ? fd.get('default_pitch_type') : 'none',
            eligible_for_orders: fd.get('eligible_for_orders') === 'on',
            flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
            sku: fd.get('sku')?.trim() || null,
        };
        // Phase 6.5 (Generic Trades) additions: same as create.
        // `formMeasurementType` is set in startEdit() and updated by the edit form's dropdown.
        const inputWithGenericTrades = genericTradesEnabled
            ? {
                ...input,
                height_value_mm: (formMeasurementType === 'length_x_height' || formMeasurementType === 'multi_lineal_lxh') && formHeightMm
                    ? Number(formHeightMm)
                    : null,
                depth_value_mm: formMeasurementType === 'volume' && formDepthMm
                    ? Number(formDepthMm)
                    : null,
                waste_unit: formWasteUnit,
                pricing_strategy: formPricingStrategy,
                pack_price: formPricingStrategy === 'per_unit' || !formPackPrice ? null : Number(formPackPrice),
                pack_size: formPricingStrategy === 'per_unit' || !formPackSize ? null : Number(formPackSize),
                pack_coverage_m2: formPricingStrategy === 'per_pack_coverage' && formPackCoverageM2
                    ? Number(formPackCoverageM2)
                    : null,
                collection_id: selectedCollectionId || null,
                notes: formNotes.trim() || null,
            }
            : { ...input, collection_id: selectedCollectionId || null, notes: formNotes.trim() || null };
        // If the user hasn't permanently dismissed the warning, show the modal
        // and stash the data for confirmation.
        if (!editWarningDismissedState) {
            setPendingUpdateData({ id, input: inputWithGenericTrades });
            setEditWarningDontShow(false);
            setEditWarningOpen(true);
            return;
        }
        // Already dismissed - proceed directly.
        await confirmUpdate(id, inputWithGenericTrades);
    }
    async function confirmUpdate(id, input) {
        setSaving(true);
        try {
            const updated = await (0, actions_1.updateComponent)(id, input);
            setComponents((prev) => prev.map((c) => (c.id === id ? updated : c)));
            cancelEdit();
            showNotice({ title: 'Component saved', tone: 'success', focus: true, description: `${updated.name} has been updated. Testing explains the calculation; you remain responsible for checking your business costs.` });
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to update component');
        }
        finally {
            setSaving(false);
        }
    }
    async function handleConfirmEditWarning() {
        if (!pendingUpdateData)
            return;
        const { id, input } = pendingUpdateData;
        // If user ticked "don't show again", persist to DB.
        if (editWarningDontShow) {
            try {
                await (0, actions_1.dismissComponentEditWarning)();
                setEditWarningDismissedState(true);
            }
            catch (err) {
                // Non-fatal: the warning will show again next time. Log and continue.
                console.error('Failed to persist edit warning dismissal:', err);
            }
        }
        setEditWarningOpen(false);
        setPendingUpdateData(null);
        await confirmUpdate(id, input);
    }
    const [deleteCompId, setDeleteCompId] = (0, react_1.useState)(null);
    const [deleteLoading, setDeleteLoading] = (0, react_1.useState)(false);
    // Component edit warning modal state
    const [editWarningOpen, setEditWarningOpen] = (0, react_1.useState)(false);
    const [editWarningDontShow, setEditWarningDontShow] = (0, react_1.useState)(false);
    const [editWarningDismissedState, setEditWarningDismissedState] = (0, react_1.useState)(editWarningDismissed);
    const [pendingUpdateData, setPendingUpdateData] = (0, react_1.useState)(null);
    async function confirmDeleteComp() {
        if (!deleteCompId)
            return;
        setDeleteLoading(true);
        try {
            // Check if the component being deleted was active (to update count).
            const comp = components.find(c => c.id === deleteCompId);
            const wasActive = comp ? comp.is_active !== false : false;
            await (0, actions_1.deleteComponent)(deleteCompId);
            setComponents((prev) => prev.filter((c) => c.id !== deleteCompId));
            if (wasActive) {
                setActiveCountState(prev => Math.max(0, prev - 1));
            }
            if (deleteCompId === editingId)
                cancelEdit();
            setDeleteCompId(null);
        }
        catch (err) {
            showNotice({ title: 'Component was not deleted', tone: 'danger', description: err instanceof Error ? err.message : 'Please try again.', focus: true });
        }
        finally {
            setDeleteLoading(false);
        }
    }
    const editingComponent = components.find(component => component.id === editingId);
    function initialForComponent(component) {
        const extra = component;
        return { name: component.name, sku: component.sku ?? '', componentType: component.component_type,
            materialRate: String(component.default_material_rate ?? 0), labourRate: String(component.default_labour_rate ?? 0),
            wasteAmount: String(component.default_waste_type === 'percent' ? component.default_waste_percent ?? 0 : component.default_waste_fixed ?? 0),
            pitchType: component.default_pitch_type, eligibleForOrders: component.eligible_for_orders ?? true,
            storedStrategy: extra.pricing_strategy ?? 'per_unit',
            storedPackPrice: String(extra.pack_price ?? ''), storedPackSize: String(extra.pack_size ?? ''), storedPackCoverage: String(extra.pack_coverage_m2 ?? ''),
            storedHeightMm: String(extra.height_value_mm ?? ''), storedDepthMm: String(extra.depth_value_mm ?? '') };
    }
    const editorInitial = editingComponent ? initialForComponent(editingComponent) : createDefaults ?? {
        name: restoredName, sku: '', componentType: filter === 'extra' ? 'extra' : 'main', materialRate: restoredMaterialRate,
        labourRate: restoredLabourRate, wasteAmount: restoredWasteAmount, pitchType: 'rafter', eligibleForOrders: true
    };
    const editorSettings = { measurementType: formMeasurementType, wasteType: formWasteType,
        pitchEnabled: formPitchEnabled, pricingStrategy: formPricingStrategy, packPrice: formPackPrice, packSize: formPackSize,
        packCoverage: formPackCoverageM2, heightMm: formHeightMm, depthMm: formDepthMm, hoursUnit: formHoursUnit,
        wasteUnit: formWasteUnit, notes: formNotes };
    function updateEditorSettings(patch) {
        setEditorDirty(true);
        setDraftTested(false);
        if (patch.measurementType !== undefined)
            setFormMeasurementType(patch.measurementType);
        if (patch.wasteType !== undefined)
            setFormWasteType(patch.wasteType);
        if (patch.pitchEnabled !== undefined)
            setFormPitchEnabled(patch.pitchEnabled);
        if (patch.pricingStrategy !== undefined)
            setFormPricingStrategy(patch.pricingStrategy);
        if (patch.packPrice !== undefined)
            setFormPackPrice(patch.packPrice);
        if (patch.packSize !== undefined)
            setFormPackSize(patch.packSize);
        if (patch.packCoverage !== undefined)
            setFormPackCoverageM2(patch.packCoverage);
        if (patch.heightMm !== undefined)
            setFormHeightMm(patch.heightMm);
        if (patch.depthMm !== undefined)
            setFormDepthMm(patch.depthMm);
        if (patch.hoursUnit !== undefined)
            setFormHoursUnit(patch.hoursUnit);
        if (patch.wasteUnit !== undefined)
            setFormWasteUnit(patch.wasteUnit);
        if (patch.notes !== undefined)
            setFormNotes(patch.notes);
    }
    async function startNew(copy) {
        if (!subscriptionActive) {
            setSubBlockedOpen(true);
            return;
        }
        // Explicitly making a copy preserves its draft values. Other navigation is
        // confirmed first; never save implicitly or bypass subscription/cap guards.
        if (!copy && !(await mayLeaveEditor()))
            return;
        setEditingId(null);
        setShowForm(true);
        setFormError(null);
        setEditorDirty(!!copy);
        setDraftTested(false);
        setCreateDefaults(copy ?? null);
        setEditorVersion(value => value + 1);
        setTestOnOpen(false);
        setTestRequest(0);
        // A copied legacy row is a NEW record: use the canonical linear enum.
        if (copy && formMeasurementType === 'linear')
            setFormMeasurementType('lineal');
        if (!copy) {
            setFormMeasurementType('area');
            setFormWasteType('none');
            setFormPitchEnabled(false);
            setFormPricingStrategy('per_unit');
            setFormPackPrice('');
            setFormPackSize('');
            setFormPackCoverageM2('');
            setFormHeightMm('');
            setFormDepthMm('');
            setFormHoursUnit('hr');
            setFormWasteUnit('percent');
            setFormNotes('');
            setAssignedFlashings([]);
            setSelectedFlashingId('');
            setRestoredName('');
            setRestoredMaterialRate('');
            setRestoredLabourRate('');
            setRestoredWasteAmount('');
            setSelectedCollectionId(activeLibraryId || collections.find(c => c.is_bootstrap)?.id || collections[0]?.id || '');
        }
    }
    function componentCostSummary(component) {
        const values = initialForComponent(component);
        if (values.storedStrategy && values.storedStrategy !== 'per_unit') {
            if (!values.storedPackPrice || !(values.storedStrategy === 'per_pack_coverage' ? values.storedPackCoverage : values.storedPackSize))
                return 'Materials: complete the pack settings';
            return `Materials: ${(0, currencies_1.formatCurrency)(Number(values.storedPackPrice || 0), companyCurrency)} per pack (${values.storedStrategy === 'per_pack_coverage' ? values.storedPackCoverage : values.storedPackSize} ${(0, componentTest_1.canonicalUnit)(component.measurement_type)})`;
        }
        return `Materials: ${(0, currencies_1.formatCurrency)(component.default_material_rate ?? 0, companyCurrency)}/${(0, componentTest_1.canonicalUnit)(component.measurement_type)}`;
    }
    (0, react_1.useEffect)(() => {
        if (showForm || editingId)
            editorAnchor.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    }, [showForm, editingId, editorVersion]);
    (0, react_1.useEffect)(() => {
        if (!editorDirty)
            return;
        const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [editorDirty]);
    return ((0, jsx_runtime_1.jsxs)(QcLibrary_1.QcLibrary, { className: "space-y-5", children: [feedback, notice, showCreateLibraryModal && ((0, jsx_runtime_1.jsx)(QcJourney_1.QcJourneyDialog, { label: "Create New Library", size: "sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "p-6 w-full", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-base font-semibold text-slate-900 mb-4", children: "Create New Library" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs text-slate-500 mb-1", children: "Library Name" }), (0, jsx_runtime_1.jsx)("input", { "aria-label": "Library Name", type: "text", value: newLibraryName, onChange: e => setNewLibraryName(e.target.value), onKeyDown: e => { if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void handleCreateLibrary();
                                            } }, placeholder: "e.g. Residential, Commercial", maxLength: 80, className: "qc-input qc-library-control w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500", autoFocus: true })] }), createLibraryError && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-red-600", children: createLibraryError })), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 pt-1", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "primary", type: "button", onClick: () => void handleCreateLibrary(), disabled: creatingLibrary || !newLibraryName.trim(), className: "qc-button qc-flow-control qc-library-control flex-1", children: creatingLibrary ? 'Creating...' : 'Create Library' }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", type: "button", onClick: () => { setShowCreateLibraryModal(false); setNewLibraryName(''); setCreateLibraryError(''); }, className: "qc-button qc-flow-control qc-library-control ", children: "Cancel" })] })] })] }) })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", { className: "qc-library-title text-xl md:text-2xl font-semibold text-slate-900", children: "Pricing library" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs md:text-sm text-slate-500 mt-1", children: "Find and reuse Smart Components\u2122: saved materials, labour and measurement settings for your quotes." })] }), (0, jsx_runtime_1.jsx)(PricingIntroduction_1.PricingIntroduction, { open: learning, onOpen: () => setLearning(true), onDismiss: () => setLearning(false), hasComponents: components.length > 0, tested: testedInSession, created: createdInSession, ownTested: ownTested, workspaceSlug: workspaceSlug, onCreate: () => { void startNew(); }, onTestCreated: () => {
                    const created = components.find(component => component.id === lastCreatedId);
                    if (created)
                        void startEdit(created, true);
                    else
                        void startNew();
                }, onChoose: () => {
                    setFilter('all');
                    setMeasurementFilter('all');
                    setSearchQuery('');
                    setActiveLibraryId('');
                    requestAnimationFrame(() => document.getElementById('qc-pricing-component-list')?.scrollIntoView({ block: 'start', behavior: 'auto' }));
                } }), collections.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap items-center gap-2 mb-1", children: renamingLibraryId && renamingLibraryId === (activeLibraryId || null) ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: renameValue, onChange: e => setRenameValue(e.target.value), onKeyDown: e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleRenameLibrary();
                                }
                                if (e.key === 'Escape') {
                                    setRenamingLibraryId(null);
                                    setRenameValue('');
                                }
                            }, maxLength: 80, className: "qc-input qc-library-control px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none", autoFocus: true }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "primary", type: "button", onClick: () => void handleRenameLibrary(), disabled: renaming || !renameValue.trim(), className: "qc-button qc-flow-control qc-library-control ", children: renaming ? 'Saving...' : 'Save' }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", type: "button", onClick: () => { setRenamingLibraryId(null); setRenameValue(''); }, className: "qc-button qc-flow-control qc-library-control ", children: "Cancel" })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-base font-semibold text-slate-900", children: activeLibraryId
                                ? ((collections.find(c => c.id === activeLibraryId)?.name ?? 'Library') + (collections.find(c => c.id === activeLibraryId)?.is_bootstrap ? ' (default)' : ''))
                                : 'All Libraries' }), activeLibraryId && isSupplier && (() => {
                            const col = collections.find(c => c.id === activeLibraryId);
                            const vis = col?.visibility ?? 'private';
                            return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [vis === 'published' && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500" }), "Published"] })), vis === 'unlisted' && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200", children: [(0, jsx_runtime_1.jsx)("span", { className: "w-1.5 h-1.5 rounded-full bg-blue-500" }), "Unlisted"] })), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", type: "button", onClick: () => setShowPublishModal(activeLibraryId), className: "qc-button qc-flow-control qc-library-control ", children: vis === 'private' ? 'Publish' : 'Settings' })] }));
                        })(), activeLibraryId && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("button", { "aria-label": "Rename library", "data-qc-variant": "ghost", type: "button", title: "Rename library", onClick: () => {
                                        const col = collections.find(c => c.id === activeLibraryId);
                                        if (col) {
                                            setRenamingLibraryId(activeLibraryId);
                                            setRenameValue(col.name);
                                        }
                                    }, className: "qc-button qc-flow-control qc-library-control ", children: (0, jsx_runtime_1.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [(0, jsx_runtime_1.jsx)("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), (0, jsx_runtime_1.jsx)("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }) }), !collections.find(c => c.id === activeLibraryId)?.is_bootstrap && ((0, jsx_runtime_1.jsx)("button", { "aria-label": "Delete library", "data-qc-variant": "ghost", type: "button", title: "Delete library", onClick: () => setDeletingLibraryId(activeLibraryId), className: "qc-button qc-flow-control qc-library-control ", children: (0, jsx_runtime_1.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [(0, jsx_runtime_1.jsx)("polyline", { points: "3 6 5 6 21 6" }), (0, jsx_runtime_1.jsx)("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), (0, jsx_runtime_1.jsx)("path", { d: "M10 11v6" }), (0, jsx_runtime_1.jsx)("path", { d: "M14 11v6" }), (0, jsx_runtime_1.jsx)("path", { d: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" })] }) }))] }))] })) })), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl w-fit max-w-full", children: [['all', 'main', 'extra'].map((f) => ((0, jsx_runtime_1.jsx)("button", { "aria-pressed": filter === f, onClick: () => setFilter(f), className: "qc-flow-control qc-library-choice " + (`px-4 py-1.5 text-sm rounded-full font-medium transition whitespace-nowrap ${filter === f
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'}`), children: f === 'all' ? 'All' : f === 'main' ? 'Main' : 'Extras' }, f))), (0, jsx_runtime_1.jsx)(link_1.default, { href: `/${workspaceSlug}/supplier-directory`, prefetch: false, className: "qc-flow-link qc-library-control px-4 py-1.5 text-sm rounded-full font-medium transition whitespace-nowrap text-slate-500 hover:text-slate-700", children: "Supplier Directory" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-2 md:flex-row", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "primary", onClick: () => { void startNew(); }, "data-copilot": "add-component", className: "qc-button qc-flow-control qc-library-control inline-flex justify-center", children: "+ Create component" }), (0, jsx_runtime_1.jsxs)("button", { "data-qc-variant": "ghost", onClick: () => {
                                    if (!subscriptionActive) {
                                        setSubBlockedOpen(true);
                                        return;
                                    }
                                    void mayLeaveEditor().then(leave => { if (leave) {
                                        cancelEdit();
                                        setShowCatalogModal(true);
                                    } });
                                }, className: "qc-button qc-flow-control qc-library-control inline-flex justify-center", children: [(0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4 mr-1.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 10h16M4 14h16M4 18h16" }) }), "Add from catalogue"] }), flashingsFeatureEnabled ? ((0, jsx_runtime_1.jsx)(link_1.default, { href: `/${workspaceSlug}/drawings`, className: "qc-button qc-flow-control", children: featureLabel })) : ((0, jsx_runtime_1.jsxs)("button", { "aria-label": `${featureLabel} requires a higher plan`, "data-qc-variant": "ghost", type: "button", onClick: () => setFlashingsUpgradeOpen(true), title: `${featureLabel} requires a higher plan`, className: "qc-button qc-flow-control qc-library-control inline-flex justify-center", children: [(0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4 mr-1.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }), featureLabel] }))] })] }), (0, jsx_runtime_1.jsx)("div", { className: "qc-library-filters", role: "group", "aria-label": "Filter by measurement", children: [
                    { key: 'all', label: 'All Types' },
                    { key: 'area', label: 'Area' },
                    { key: 'lineal', label: 'Linear' },
                    { key: 'rafter', label: 'Rafter Pitch' },
                    { key: 'valley_hip', label: 'Hip/Valley Pitch' },
                ].map(f => ((0, jsx_runtime_1.jsx)("button", { "aria-pressed": measurementFilter === f.key, onClick: () => setMeasurementFilter(f.key), className: "qc-flow-control qc-library-choice " + (`px-3 py-1 text-xs font-medium rounded-full border transition whitespace-nowrap ${measurementFilter === f.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`), children: f.label }, f.key))) }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-library-search-bar flex items-center gap-3 flex-wrap", children: [collections.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "qc-library-library-picker flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("select", { "aria-label": "Component library", value: activeLibraryId, onChange: e => setActiveLibraryId(e.target.value), className: "qc-select qc-library-control px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All Libraries" }), collections.map(col => ((0, jsx_runtime_1.jsxs)("option", { value: col.id, children: [col.name, col.is_bootstrap ? ' (bootstrap)' : ''] }, col.id)))] }), activeLibraryId && ((0, jsx_runtime_1.jsxs)("button", { "aria-label": savedDefaultLibId === activeLibraryId ? 'This is your default library' : 'Set as default library', type: "button", title: savedDefaultLibId === activeLibraryId ? 'This is your default library' : 'Set as default library', onClick: () => {
                                    const isAlreadyDefault = savedDefaultLibId === activeLibraryId;
                                    if (isAlreadyDefault) {
                                        // Clear the default
                                        localStorage.removeItem(LOCAL_KEY);
                                        setSavedDefaultLibId('');
                                        setDefaultLibraryFlash('Default cleared');
                                    }
                                    else {
                                        localStorage.setItem(LOCAL_KEY, activeLibraryId);
                                        setSavedDefaultLibId(activeLibraryId);
                                        const name = collections.find(c => c.id === activeLibraryId)?.name ?? 'Library';
                                        setDefaultLibraryFlash(`"${name}" set as default`);
                                    }
                                    setTimeout(() => setDefaultLibraryFlash(null), 2000);
                                }, className: "qc-flow-control qc-library-choice " + (`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-all ${savedDefaultLibId === activeLibraryId
                                    ? 'bg-orange-50 border-orange-300 text-orange-600 hover:bg-orange-100'
                                    : 'bg-white border-slate-300 text-slate-500 hover:border-orange-300 hover:text-orange-500'}`), children: [(0, jsx_runtime_1.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: savedDefaultLibId === activeLibraryId ? 'currentColor' : 'none', stroke: "currentColor", strokeWidth: "2", children: (0, jsx_runtime_1.jsx)("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }) }), savedDefaultLibId === activeLibraryId ? 'Default' : 'Set as default'] })), defaultLibraryFlash && ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-orange-500 font-medium animate-pulse", children: defaultLibraryFlash }))] })), (0, jsx_runtime_1.jsxs)("div", { className: "qc-library-component-search relative flex-1 max-w-sm", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), "aria-label": "Search components", placeholder: "Search components\u2026", className: "qc-input qc-flow-search qc-library-control w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none" }), (0, jsx_runtime_1.jsx)("svg", { className: "absolute left-3 top-2.5 w-4 h-4 text-slate-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }), searchQuery && ((0, jsx_runtime_1.jsx)("button", { type: "button", "aria-label": "Clear component search", "data-qc-variant": "ghost", onClick: () => setSearchQuery(''), className: "qc-button qc-flow-control qc-library-control qc-search-clear", children: "\u00D7" }))] })] }), (0, jsx_runtime_1.jsx)("div", { ref: editorAnchor, className: "qc-pricing-editor-anchor", children: (showForm || editingComponent) && ((0, jsx_runtime_1.jsx)(SmartComponentEditor_1.SmartComponentEditor, { mode: editingComponent ? 'edit' : 'create', initial: editorInitial, settings: editorSettings, onSettingsChange: updateEditorSettings, measurementSystem: companyMeasurementSystem, currency: companyCurrency, genericTradesEnabled: genericTradesEnabled, pitchVisible: pitchVisible, pitchHidesValleyHip: pitchHidesValleyHip, pitchRafterLabel: pitchRafterLabel, pitchCheckboxLabel: pitchCheckboxLabel, collections: collections, selectedCollectionId: selectedCollectionId, onCollectionChange: value => { setEditorDirty(true); if (value === '__create_new__')
                        setShowCreateLibraryModal(true);
                    else
                        setSelectedCollectionId(value); }, flashings: flashings, assignedFlashings: assignedFlashings, selectedFlashingId: selectedFlashingId, onFlashingSelection: setSelectedFlashingId, onAddFlashing: addFlashing, onRemoveFlashing: removeFlashing, imageHelperText: imageHelperText, supplierSkuRequired: !!(isSupplier && collections.find(c => c.id === activeLibraryId)?.visibility === 'published'), saving: saving, error: formError, onSubmit: editingComponent ? event => handleUpdate(event, editingComponent.id) : handleCreate, onCancel: () => { void mayLeaveEditor().then(leave => { if (leave)
                        cancelEdit(); }); }, onDirty: () => { setEditorDirty(true); setDraftTested(false); }, onCalculated: () => {
                        setTestedInSession(true);
                        if (showForm)
                            setDraftTested(true);
                        if (editingId && editingId === lastCreatedId)
                            setOwnTested(true);
                    }, onCopy: copy => { void startNew(copy); }, openTestInitially: testOnOpen, testRequest: testRequest, learning: learning }, `${editingId ?? 'new'}-${editorVersion}`)) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("span", { className: `inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${atCap ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`, children: componentLimit !== null
                                    ? `${activeCountState} / ${componentLimit} active`
                                    : `${activeCountState} active` }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: componentLimit !== null
                                    ? `Smart Components on your ${effectivePlanCode} plan`
                                    : 'Smart Components - unlimited on your plan' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [!atCap && componentLimit !== null && ((0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-400", children: [componentLimit - activeCountState, " slot", (componentLimit - activeCountState) !== 1 ? 's' : '', " free"] })), atCap && ((0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", onClick: () => setUpgradeOpen(true), className: "qc-button qc-flow-control qc-library-control shrink-0 inline-flex", children: "Upgrade" }))] })] }), (0, jsx_runtime_1.jsx)("div", { id: "qc-pricing-component-list", className: "space-y-2", children: filtered.map((comp) => ((0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsxs)("div", { id: `component-row-${comp.id}`, onClick: () => startEdit(comp), title: "Click to view component", className: `qc-component-row px-4 py-3 border rounded-xl cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group ${highlightId === comp.id
                            ? 'border-orange-300 bg-orange-50 shadow-[0_0_12px_rgba(255,107,53,0.25)]'
                            : comp.is_active === false
                                ? 'border-slate-200 bg-slate-50/50'
                                : 'border-slate-200 bg-white'}`, children: [(0, jsx_runtime_1.jsxs)("span", { className: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${comp.is_active === false
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200'
                                    : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`, children: [(0, jsx_runtime_1.jsx)("span", { className: `w-1.5 h-1.5 rounded-full ${comp.is_active === false ? 'bg-slate-300' : 'bg-emerald-500'}` }), comp.is_active === false ? 'Inactive' : 'Active'] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-component-row-meta", children: [(0, jsx_runtime_1.jsx)("h3", { className: `font-medium ${comp.is_active === false ? 'text-slate-500' : 'text-slate-900'}`, children: (0, jsx_runtime_1.jsx)("button", { type: "button", className: "qc-library-action-name", onClick: (event) => { event.stopPropagation(); startEdit(comp); }, children: comp.name }) }), comp.sku && ((0, jsx_runtime_1.jsx)("span", { className: "text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono", children: comp.sku })), (0, jsx_runtime_1.jsx)("span", { className: `text-xs px-2 py-0.5 rounded-full font-medium ${comp.component_type === 'main' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`, children: comp.component_type }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: MEASUREMENT_LABELS[comp.measurement_type] })] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-500 mt-0.5", children: [componentCostSummary(comp), " \u00B7 Labour: ", (0, currencies_1.formatCurrency)(comp.default_labour_rate ?? 0, companyCurrency), "/", (0, componentTest_1.canonicalUnit)(comp.measurement_type), comp.default_waste_type !== 'none' && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [" \u00B7 Waste: ", comp.default_waste_type === 'percent' ? `${comp.default_waste_percent}%` : `${comp.default_waste_fixed} ${(0, componentTest_1.canonicalUnit)(comp.measurement_type)}`] })), comp.default_pitch_type !== 'none' && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [" \u00B7 ", helpers_1.PITCH_LABELS[comp.default_pitch_type]] })] }), comp.notes && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 italic mt-1 line-clamp-1", children: comp.notes }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-component-row-actions", children: [(0, jsx_runtime_1.jsx)("button", { "aria-label": comp.is_active === false ? 'Activate component' : 'Deactivate component', onClick: (e) => {
                                            e.stopPropagation();
                                            if (!activatingId || activatingId !== comp.id) {
                                                void handleToggleActive(comp.id, comp.is_active === false);
                                            }
                                        }, disabled: activatingId === comp.id, title: comp.is_active === false ? 'Activate component' : 'Deactivate component', "aria-pressed": comp.is_active !== false, className: "qc-flow-control qc-library-choice " + (`qc-component-activation p-1.5 rounded-xl transition disabled:opacity-60 ${comp.is_active === false
                                            ? 'text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:shadow-[0_0_10px_rgba(16,185,129,0.35)]'
                                            : 'text-slate-600 hover:text-red-500 hover:bg-red-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]'}`), children: activatingId === comp.id ? ((0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4 animate-spin", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" }) })) : comp.is_active === false ? ((0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) })) : ((0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" }) })) }), (0, jsx_runtime_1.jsxs)("button", { "aria-label": `Open and test ${comp.name}`, "data-qc-variant": "ghost", onClick: (e) => { e.stopPropagation(); void startEdit(comp, true); }, title: "Open and test this component", className: "qc-button qc-flow-control qc-library-control ", children: [(0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" }) }), "Open & test"] }), (0, jsx_runtime_1.jsx)("button", { "aria-label": `Delete ${comp.name}`, "data-qc-variant": "ghost", onClick: (e) => { e.stopPropagation(); setDeleteCompId(comp.id); }, title: "Click to delete", className: "qc-button qc-flow-control qc-library-control ", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] })] }) }, comp.id))) }), deleteCompId && ((0, jsx_runtime_1.jsx)(QcJourney_1.QcJourneyDialog, { label: "Delete Smart Component\u2122", size: "sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "p-4 md:p-6 w-full", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-900", children: "Delete Smart Component\u2122" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2", children: "This action cannot be undone. The Smart Component\u2122 will be removed from your library." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 justify-end mt-6", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", onClick: () => setDeleteCompId(null), className: "qc-button qc-flow-control qc-library-control ", disabled: deleteLoading, children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "danger", onClick: confirmDeleteComp, className: "qc-button qc-flow-control qc-library-control ", disabled: deleteLoading, children: deleteLoading ? 'Deleting...' : 'Delete' })] })] }) })), deletingLibraryId && ((0, jsx_runtime_1.jsx)(QcJourney_1.QcJourneyDialog, { label: "Delete Library", size: "sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "p-4 md:p-6 w-full", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-900", children: "Delete Library" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2", children: "Deleting this library will delete all components inside it. Move any components you want to keep to another library first, or delete them forever here." }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-2", children: "This action cannot be undone." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 justify-end mt-6", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", onClick: () => setDeletingLibraryId(null), disabled: deleteLibraryLoading, className: "qc-button qc-flow-control qc-library-control ", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "danger", onClick: () => void handleDeleteLibrary(), disabled: deleteLibraryLoading, className: "qc-button qc-flow-control qc-library-control ", children: deleteLibraryLoading ? 'Deleting...' : 'Delete Library' })] })] }) })), (0, jsx_runtime_1.jsx)(UpgradeModal_1.UpgradeModal, { open: upgradeOpen, onClose: () => setUpgradeOpen(false), title: `Active Smart Component limit reached on the ${effectivePlanCode} plan`, description: `You can store unlimited Smart Components, but only ${componentLimit ?? 0} can be active at once. Deactivate components you don't need, or upgrade to activate more.`, recommendedPlan: "growth" }), (0, jsx_runtime_1.jsx)(UpgradeModal_1.UpgradeModal, { open: flashingsUpgradeOpen, onClose: () => setFlashingsUpgradeOpen(false), title: `${featureLabelSingular} drawings require a higher plan`, description: `Upgrade your account to access the ${featureLabel.toLowerCase()} drawing tool and reusable library.`, recommendedPlan: "pro" }), (0, jsx_runtime_1.jsx)(UpgradeModal_1.UpgradeModal, { open: subBlockedOpen, onClose: () => setSubBlockedOpen(false), title: "Your subscription is inactive", description: "You need to subscribe to a plan to create more Smart Components\u2122. Your existing Smart Components\u2122 remain viewable on any plan.", ctaLabel: "View plans", recommendedPlan: "starter" }), editWarningOpen && ((0, jsx_runtime_1.jsx)(QcJourney_1.QcJourneyDialog, { label: "Heads up before saving", size: "sm", children: (0, jsx_runtime_1.jsxs)("div", { className: "p-4 md:p-6 w-full", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-slate-900", children: "Heads up before saving" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2", children: "Beware: edited changes will only affect new component entries moving forward, not previously saved component entries." }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 mt-4 text-xs text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: editWarningDontShow, onChange: (e) => setEditWarningDontShow(e.target.checked), className: "qc-checkbox qc-library-control h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" }), "Don\u2019t show me this warning anymore"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 justify-end mt-6", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", type: "button", onClick: () => {
                                        setEditWarningOpen(false);
                                        setPendingUpdateData(null);
                                    }, className: "qc-button qc-flow-control qc-library-control ", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "primary", type: "button", onClick: () => void handleConfirmEditWarning(), disabled: saving, className: "qc-button qc-flow-control qc-library-control ", children: saving ? 'Saving...' : 'Confirm and Save' })] })] }) })), showPublishModal && isSupplier && (() => {
                const col = collections.find(c => c.id === showPublishModal);
                if (!col)
                    return null;
                return (0, jsx_runtime_1.jsx)(PublishLibraryModal_1.PublishLibraryModal, { collectionId: col.id, collectionName: col.name, currentVisibility: (col.visibility ?? 'private'), publicTitle: col.public_title ?? '', publicDescription: col.public_description ?? '', roofingTypes: col.roofing_types ?? [], onClose: () => setShowPublishModal(null), onSaved: async () => {
                        setShowPublishModal(null);
                        // Reload collections by re-fetching the page data
                        window.location.reload();
                    } });
            })(), showCatalogModal && ((0, jsx_runtime_1.jsx)(AddFromCatalogModal_1.AddFromCatalogModal, { workspaceSlug: workspaceSlug, collections: collections.map(c => ({
                    id: c.id,
                    name: c.name,
                    is_bootstrap: c.is_bootstrap,
                    component_count: undefined,
                })), onClose: () => {
                    setShowCatalogModal(false);
                    // Only refresh after the user has read the confirmed import result.
                    // Opening import is dirty-guarded; no active draft is discarded.
                    if (catalogueChanged)
                        window.location.assign(`/${workspaceSlug}/components?reviewImport=1`);
                }, onCreated: () => setCatalogueChanged(true) }))] }));
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/useQcFeedback.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useQcFeedback = useQcFeedback;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const AlertModal_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/AlertModal.tsx");
const ConfirmModal_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ConfirmModal.tsx");
/** Awaitable feedback preserves the pause formerly provided by native dialogs.
 * Only UI acknowledgements live here; no mutation, validation or pricing is added.
 */
function useQcFeedback() {
    const queue = (0, react_1.useRef)([]);
    const [request, setRequest] = (0, react_1.useState)(null);
    const enqueue = (0, react_1.useCallback)((kind, options) => new Promise(resolve => {
        const next = { ...options, kind, resolve };
        queue.current.push(next);
        if (queue.current.length === 1)
            setRequest(next);
    }), []);
    const notify = (0, react_1.useCallback)(async (description, title = 'Please check this action') => {
        await enqueue('alert', { title, description, confirmLabel: 'OK' });
    }, [enqueue]);
    const ask = (0, react_1.useCallback)((options) => enqueue('confirm', options), [enqueue]);
    const settle = (0, react_1.useCallback)((accepted) => {
        const current = queue.current.shift();
        setRequest(queue.current[0] ?? null);
        current?.resolve(accepted);
    }, []);
    (0, react_1.useEffect)(() => () => {
        // Do not leave waiting UI tasks behind after the owning page unmounts.
        queue.current.splice(0).forEach(item => item.resolve(false));
    }, []);
    const feedback = request?.kind === 'confirm' ? ((0, jsx_runtime_1.jsx)(ConfirmModal_1.ConfirmModal, { appearance: "v2", open: true, title: request.title, description: request.description, confirmLabel: request.confirmLabel ?? 'Continue', cancelLabel: request.cancelLabel ?? 'Cancel', destructive: request.destructive ?? false, onCancel: () => settle(false), onConfirm: () => settle(true) })) : ((0, jsx_runtime_1.jsx)(AlertModal_1.AlertModal, { appearance: "v2", open: request !== null, title: request?.title ?? '', description: request?.description, confirmLabel: request?.confirmLabel, onClose: () => settle(true) }));
    return { notify, ask, feedback, feedbackOpen: request !== null };
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/AlertModal.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertModal = AlertModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QcDialog_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcDialog.tsx");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
/**
 * Single-button modal alert used to replace native `alert(...)` calls.
 * Matches the look & feel of `ConfirmModal` so the whole app feels consistent
 * regardless of whether the message is a confirmation, an error, or a
 * success notification.
 *
 * For yes/no prompts use `ConfirmModal`; for plain "got it" messages use this.
 */
function AlertModal({ open, appearance, title, description, confirmLabel = 'OK', variant = 'info', onClose, }) {
    const closeRef = (0, react_1.useRef)(null);
    // Close on Escape so keyboard users aren't trapped.
    (0, react_1.useEffect)(() => {
        if (!open || appearance === 'v2')
            return;
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, appearance]);
    if (!open)
        return null;
    if (appearance === 'v2') {
        return (0, jsx_runtime_1.jsx)(QcDialog_1.QcDialog, { open: open, title: title, description: description, onRequestClose: onClose, initialFocusRef: closeRef, footer: (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { ref: closeRef, variant: variant === 'error' ? 'secondary' : 'primary', onClick: onClose, children: confirmLabel }) });
    }
    // Variant-driven styling. Errors get red; success gets green; info uses
    // the same neutral black we use for primary CTAs elsewhere.
    const buttonClass = variant === 'error'
        ? 'bg-red-600 text-white hover:bg-red-700'
        : variant === 'success'
            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
            : 'bg-black text-white hover:bg-slate-800';
    const iconBgClass = variant === 'error'
        ? 'bg-red-100 text-red-600'
        : variant === 'success'
            ? 'bg-emerald-100 text-emerald-600'
            : 'bg-slate-100 text-slate-600';
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": "alert-modal-title", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: `mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBgClass}`, children: variant === 'error' ? ((0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" }) })) : variant === 'success' ? ((0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })) : ((0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) })) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsx)("h3", { id: "alert-modal-title", className: "text-lg font-semibold text-slate-900", children: title }), description && (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2 whitespace-pre-line break-words", children: description })] })] }), (0, jsx_runtime_1.jsx)("div", { className: "flex gap-3 justify-end mt-6", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClose, autoFocus: true, className: `px-4 py-2 text-sm font-medium rounded-full ${buttonClass}`, children: confirmLabel }) })] }) }));
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcDialog.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcDialog = QcDialog;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc.css");
let openDialogCount = 0;
let originalBodyOverflow = '';
function lockBody() {
    if (openDialogCount++ === 0) {
        originalBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    return () => {
        openDialogCount = Math.max(0, openDialogCount - 1);
        if (openDialogCount === 0)
            document.body.style.overflow = originalBodyOverflow;
    };
}
/** C27 + C29. Native modal top layer supplies inert background and focus containment.
 * The feature still owns open/close, dirty state, confirmation and request timing.
 * Never add a backdrop click handler here: that is a locked product rule.
 */
function QcDialog({ open, onRequestClose, pending = false, title, labelledBy, description, children, footer, size = 'sm', initialFocusRef, className = '' }) {
    const dialogRef = (0, react_1.useRef)(null);
    const titleId = (0, react_1.useId)();
    const descriptionId = (0, react_1.useId)();
    const initialFocus = (0, react_1.useRef)(initialFocusRef);
    initialFocus.current = initialFocusRef;
    (0, react_1.useEffect)(() => {
        const dialog = dialogRef.current;
        if (!open || !dialog)
            return;
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (!dialog.open)
            dialog.showModal();
        const unlock = lockBody();
        initialFocus.current?.current?.focus();
        return () => {
            if (dialog.open)
                dialog.close();
            unlock();
            if (trigger?.isConnected)
                trigger.focus({ preventScroll: true });
        };
    }, [open]);
    if (!open)
        return null;
    return ((0, jsx_runtime_1.jsxs)("dialog", { ref: dialogRef, "data-qc-ui": "v2", "data-qc-component": "C27", "data-qc-size": size, className: `qc-dialog ${className}`, "aria-modal": "true", "aria-labelledby": labelledBy || titleId, "aria-describedby": description ? descriptionId : undefined, onCancel: event => { event.preventDefault(); if (!pending)
            onRequestClose(); }, children: [title && (0, jsx_runtime_1.jsxs)("header", { className: "qc-dialog-header", children: [(0, jsx_runtime_1.jsx)("h2", { id: titleId, children: title }), description && (0, jsx_runtime_1.jsx)("p", { id: descriptionId, children: description })] }), children && (0, jsx_runtime_1.jsx)("div", { className: "qc-dialog-body", children: children }), footer && (0, jsx_runtime_1.jsx)("div", { className: "qc-dialog-footer", children: footer })] }));
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ConfirmModal.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmModal = ConfirmModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QcDialog_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcDialog.tsx");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
/**
 * Shared confirm dialog. Matches the QuotesList delete modal pattern so all
 * destructive prompts in the app feel consistent.
 */
function ConfirmModal({ open, appearance, title, description, confirmLabel = 'Delete', cancelLabel = 'Cancel', destructive = true, pending = false, pendingLabel = 'Working...', onCancel, onConfirm, }) {
    const cancelRef = (0, react_1.useRef)(null);
    // Close on Escape
    (0, react_1.useEffect)(() => {
        if (!open || appearance === 'v2')
            return;
        function onKey(e) {
            if (e.key === 'Escape' && !pending)
                onCancel();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, pending, onCancel, appearance]);
    if (!open)
        return null;
    if (appearance === 'v2') {
        return ((0, jsx_runtime_1.jsx)(QcDialog_1.QcDialog, { open: open, title: title, description: description, pending: pending, onRequestClose: onCancel, initialFocusRef: cancelRef, footer: (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { ref: cancelRef, onClick: onCancel, disabled: pending, children: cancelLabel }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { onClick: onConfirm, pending: pending, variant: destructive ? 'danger' : 'primary', children: pending ? pendingLabel : confirmLabel })] }) }));
    }
    const confirmClass = destructive
        ? 'bg-red-600 text-white hover:bg-red-700'
        : 'bg-black text-white hover:bg-slate-800';
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": "confirm-modal-title", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl", children: [(0, jsx_runtime_1.jsx)("h3", { id: "confirm-modal-title", className: "text-lg font-semibold text-slate-900", children: title }), description && (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2", children: description }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 justify-end mt-6", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onCancel, className: "px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50", disabled: pending, children: cancelLabel }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onConfirm, className: `px-4 py-2 text-sm font-medium rounded-full disabled:opacity-50 ${confirmClass}`, disabled: pending, children: pending ? pendingLabel : confirmLabel })] })] }) }));
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcActionNotice.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcActionNotice = QcActionNotice;
exports.useQcActionNotice = useQcActionNotice;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
const QcSurface_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcSurface.tsx");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-feedback.css");
/** C66 composes C30/C01. A persistent, local result, not a toast or request owner.
 * The feature supplies the real outcome. Dismiss never retries a mutation.
 * Mount outside completed dialogs; blocking form errors stay inside their form.
 */
function QcActionNotice({ result, onDismiss }) {
    const headingId = (0, react_1.useId)();
    const regionRef = (0, react_1.useRef)(null);
    const triggerRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!result?.focus)
            return;
        // Let native dialog cleanup restore its trigger first, then expose the result.
        const frame = requestAnimationFrame(() => {
            if (document.activeElement instanceof HTMLElement && !regionRef.current?.contains(document.activeElement)) {
                triggerRef.current = document.activeElement;
            }
            regionRef.current?.focus({ preventScroll: true });
            regionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return () => cancelAnimationFrame(frame);
    }, [result]);
    function dismiss() {
        const region = regionRef.current;
        // Do not strand keyboard focus on a button that is about to disappear.
        if (region?.contains(document.activeElement)) {
            const trigger = triggerRef.current;
            const fallback = Array.from(region.closest('main')?.querySelectorAll('h1, button:not(:disabled), a[href]') ?? [])
                .find(element => !region.contains(element));
            const target = trigger?.isConnected && trigger !== document.body && !region.contains(trigger) && !trigger.matches(':disabled')
                ? trigger : fallback;
            if (target) {
                const needsTabIndex = !target.hasAttribute('tabindex') && target.tagName === 'H1';
                if (needsTabIndex)
                    target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
                if (needsTabIndex)
                    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
            }
        }
        onDismiss();
    }
    return (0, jsx_runtime_1.jsx)("div", { "data-qc-ui": "v2", "data-qc-component": "C66", className: "qc-action-feedback", children: (0, jsx_runtime_1.jsx)("div", { "aria-live": result?.tone === 'danger' ? 'assertive' : 'polite', "aria-atomic": "true", children: result && (0, jsx_runtime_1.jsx)("div", { ref: regionRef, tabIndex: -1, role: "region", "aria-labelledby": headingId, className: "qc-action-result", children: (0, jsx_runtime_1.jsxs)(QcSurface_1.QcNotice, { tone: result.tone ?? 'info', children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-action-result-heading", children: [(0, jsx_runtime_1.jsx)("h2", { id: headingId, children: result.title }), (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { size: "sm", onClick: dismiss, "aria-label": "Dismiss result", children: "Dismiss" })] }), (0, jsx_runtime_1.jsx)("p", { className: "qc-action-result-description", children: result.description }), !!result.details?.length && (0, jsx_runtime_1.jsxs)("details", { className: "qc-action-result-details", children: [(0, jsx_runtime_1.jsxs)("summary", { children: ["View details (", result.details.length, ")"] }), (0, jsx_runtime_1.jsx)("ul", { tabIndex: 0, "aria-label": "Operation details", children: result.details.map((detail, index) => (0, jsx_runtime_1.jsx)("li", { children: detail }, index)) })] })] }) }) }) });
}
/** Local state only; no timers, provider assumptions, fetching, refresh or mutation. */
function useQcActionNotice() {
    const [result, setResult] = (0, react_1.useState)(null);
    const showNotice = (0, react_1.useCallback)((next) => setResult(next), []);
    const clearNotice = (0, react_1.useCallback)(() => setResult(null), []);
    return { showNotice, clearNotice,
        notice: (0, jsx_runtime_1.jsx)(QcActionNotice, { result: result, onDismiss: clearNotice }) };
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcSurface.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcSurface = QcSurface;
exports.QcNotice = QcNotice;
exports.QcStatusBadge = QcStatusBadge;
const jsx_runtime_1 = require("react/jsx-runtime");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc.css");
/** C18. Solid data surface. Glass is reserved for floating controls. */
function QcSurface({ className = '', ...props }) {
    return (0, jsx_runtime_1.jsx)("div", { ...props, "data-qc-component": "C18", className: `qc-surface ${className}` });
}
/** C30. Copy and the decision to announce it belong to the feature. */
function QcNotice({ children, tone = 'neutral', className = '', ...props }) {
    return (0, jsx_runtime_1.jsxs)("div", { ...props, "data-qc-component": "C30", "data-qc-tone": tone, className: `qc-notice ${className}`, children: [(0, jsx_runtime_1.jsxs)("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", children: [(0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "12", r: "9" }), (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", d: "M12 11v6m0-10v.1" })] }), (0, jsx_runtime_1.jsx)("div", { children: children })] });
}
/** C13. Display only. The caller supplies the existing status, never a transition. */
function QcStatusBadge({ children, tone = 'neutral' }) {
    return (0, jsx_runtime_1.jsx)("span", { "data-qc-component": "C13", "data-qc-tone": tone, className: "qc-status", children: children });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-feedback.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcLibrary.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcLibrary = QcLibrary;
exports.QcLibraryError = QcLibraryError;
exports.QcLibraryEmpty = QcLibraryEmpty;
exports.QcTemplateNav = QcTemplateNav;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = require("next/link");
const QcJourney_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcJourney.tsx");
const QcIcon_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcIcon.tsx");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-library.css");
/** C64. Opt-in library/template presentation; consumers own data and actions.
 * Never put protected canvases or recipient document renderers inside this scope.
 */
function QcLibrary({ children, className = '', ...props }) {
    return (0, jsx_runtime_1.jsx)(QcJourney_1.QcJourney, { ...props, className: `qc-library ${className}`, "data-qc-library": "C64", children: children });
}
function QcLibraryError({ title = 'Unable to load this section', children, onRetry }) {
    return (0, jsx_runtime_1.jsxs)("div", { className: "qc-library-error", role: "alert", children: [(0, jsx_runtime_1.jsx)("strong", { children: title }), (0, jsx_runtime_1.jsx)("p", { children: children }), onRetry && (0, jsx_runtime_1.jsx)("button", { type: "button", className: "qc-button qc-flow-control", onClick: onRetry, children: "Try again" })] });
}
function QcLibraryEmpty({ title, children, action }) {
    return (0, jsx_runtime_1.jsxs)("div", { className: "qc-flow-empty", children: [(0, jsx_runtime_1.jsx)("h2", { className: "qc-flow-section-title", children: title }), children && (0, jsx_runtime_1.jsx)("p", { className: "qc-flow-description qc-library-empty-copy", children: children }), action] });
}
/** Two destinations, not two stores. Existing type-specific template owners remain separate. */
function QcTemplateNav({ workspaceSlug, current }) {
    return (0, jsx_runtime_1.jsxs)("nav", { className: "qc-library-destinations", "aria-label": "Template libraries", children: [(0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${workspaceSlug}/resources/document-templates`, "aria-current": current === 'documents' ? 'page' : undefined, className: "qc-library-destination", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "file" }), (0, jsx_runtime_1.jsx)("span", { children: "Document templates" })] }), (0, jsx_runtime_1.jsxs)(link_1.default, { href: `/${workspaceSlug}/resources/message-templates`, "aria-current": current === 'messages' ? 'page' : undefined, className: "qc-library-destination", children: [(0, jsx_runtime_1.jsx)(QcIcon_1.QcIcon, { name: "mail" }), (0, jsx_runtime_1.jsx)("span", { children: "Message templates" })] })] });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcJourney.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcJourney = QcJourney;
exports.QcJourneyHeader = QcJourneyHeader;
exports.QcJourneySteps = QcJourneySteps;
exports.QcJourneyDialog = QcJourneyDialog;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QcDialog_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcDialog.tsx");
const QcHostedDialog_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcHostedDialog.tsx");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc.css");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-journeys.css");
/** C61: opt-in presentation for the journeys between workspaces.
 * No request, routing, form, entitlement or selection state is owned here.
 * Only explicitly classed controls are styled; embedded workspaces are not reset.
 */
function QcJourney({ children, className = '', ...props }) {
    return (0, jsx_runtime_1.jsx)("div", { ...props, "data-qc-ui": "v2", "data-qc-component": "C61", className: `qc-journey ${className}`, children: children });
}
function QcJourneyHeader({ title, description, eyebrow, children }) {
    return (0, jsx_runtime_1.jsxs)("header", { className: "qc-journey-header", children: [(0, jsx_runtime_1.jsxs)("div", { children: [eyebrow && (0, jsx_runtime_1.jsx)("p", { className: "qc-journey-eyebrow", children: eyebrow }), (0, jsx_runtime_1.jsx)("h1", { children: title }), description && (0, jsx_runtime_1.jsx)("p", { children: description })] }), children && (0, jsx_runtime_1.jsx)("div", { className: "qc-journey-header-actions", children: children })] });
}
/** C62: non-interactive progress, reflecting (never driving) the caller's step.
 * It intentionally cannot skip validation or move a user between stages.
 */
function QcJourneySteps({ steps, current, label = 'Progress' }) {
    return (0, jsx_runtime_1.jsx)("ol", { className: "qc-journey-steps", "aria-label": label, "data-qc-component": "C62", children: steps.map((step, index) => (0, jsx_runtime_1.jsxs)("li", { "aria-current": index === current ? 'step' : undefined, "data-complete": index < current || undefined, children: [(0, jsx_runtime_1.jsx)("span", { "aria-hidden": "true", children: index < current ? '✓' : index + 1 }), (0, jsx_runtime_1.jsx)("strong", { children: step })] }, step)) });
}
/** C63: use the existing C27 native-dialog controller, not a second overlay system.
 * Original content/handlers are supplied as children. Default Escape policy is
 * explicit-action-only, as in the converted legacy overlays. Backdrop never closes.
 * Only pass onRequestClose when that flow already supports Escape dismissal.
 */
function QcJourneyDialog({ label, children, size = 'md', onRequestClose, pending = false }) {
    const id = (0, react_1.useId)();
    return (0, jsx_runtime_1.jsxs)(QcDialog_1.QcDialog, { open: true, labelledBy: id, size: size, pending: pending || !onRequestClose, onRequestClose: onRequestClose ?? (() => { }), className: "qc-journey-dialog", children: [(0, jsx_runtime_1.jsx)("span", { id: id, className: "qc-flow-sr-only", children: label }), (0, jsx_runtime_1.jsx)(QcHostedDialog_1.QcHostedDialogScope, { enabled: true, children: (0, jsx_runtime_1.jsx)("div", { className: "qc-flow-dialog-content", children: children }) })] });
}

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcHostedDialog.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QcHostedButton = void 0;
exports.QcHostedDialogScope = QcHostedDialogScope;
exports.QcHostedDialog = QcHostedDialog;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QcDialog_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcDialog.tsx");
const QcButton_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcButton.tsx");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-hosted-dialog.css");
const HostedDialogPresentation = (0, react_1.createContext)(false);
/** Opt in a reviewed flow, never the whole app. Inherited by nested pickers.
 * Disabled for the hidden desktop owner beneath the mobile/touch workspace.
 */
function QcHostedDialogScope({ enabled, children }) {
    return (0, jsx_runtime_1.jsx)(HostedDialogPresentation.Provider, { value: enabled, children: children });
}
/** C53: compatibility adapter onto C27, not a second modal controller.
 * Keeps existing form state/callbacks in the caller and leaves non-opted-in
 * callers on their original div. The named close callback is optional: absent
 * means the original explicit-action-only Escape policy. Backdrop NEVER closes.
 * Existing key handlers remain on the content (e.g. Line's Enter/Escape).
 *
 * floating (2026-09-25): small measurement-entry dialogs that must NOT block
 * the canvas behind them - no backdrop blur/dim beyond a faint veil, and a
 * drag grip so the user can move the dialog aside to read the plan (e.g. the
 * line they just drew whose length they are typing in). Works in both the
 * native-dialog path (drags the <dialog>) and the legacy div path (drags the
 * first card child).
 *
 * modeless (2026-09-25, desktop scope only): renders a plain floating card
 * instead of a native modal - NO backdrop, NO inert background, NO body
 * scroll lock. The page/canvas behind stays fully interactive (pan/zoom) so
 * the user can reveal the measurement they need while the card is open.
 * Freeform drag via the header strip. Legacy (touch) scope is untouched.
 */
function QcHostedDialog({ label, size = 'sm', onRequestClose, pending = false, floating = false, modeless = false, className = '', children, ...legacyProps }) {
    const enabled = (0, react_1.useContext)(HostedDialogPresentation);
    const nameId = (0, react_1.useId)();
    // Pointer-based drag of the floating dialog. The drag target is the native
    // <dialog> (enabled path) or the legacy overlay's first card (div path).
    // The translation lives in element-local CSS vars so re-renders never fight
    // the drag offset and no React state is needed.
    const onGripPointerDown = (0, react_1.useCallback)((event) => {
        if (event.button !== 0)
            return;
        const grip = event.currentTarget;
        const dragTarget = (enabled ? grip.closest('dialog') : grip.nextElementSibling);
        if (!dragTarget)
            return;
        event.preventDefault();
        grip.setPointerCapture(event.pointerId);
        let dx = parseFloat(dragTarget.style.getPropertyValue('--qc-drag-x')) || 0;
        let dy = parseFloat(dragTarget.style.getPropertyValue('--qc-drag-y')) || 0;
        const lastX = event.clientX;
        const lastY = event.clientY;
        const rect = dragTarget.getBoundingClientRect(); // geometry at drag start
        const minX = 8 - rect.left;
        const maxX = window.innerWidth - 8 - rect.right;
        const minY = 8 - rect.top;
        const maxY = window.innerHeight - 8 - rect.bottom;
        const onMove = (e) => {
            dx = Math.min(Math.max(dx + (e.clientX - lastX), minX), maxX);
            dy = Math.min(Math.max(dy + (e.clientY - lastY), minY), maxY);
            dragTarget.style.setProperty('--qc-drag-x', `${dx}px`);
            dragTarget.style.setProperty('--qc-drag-y', `${dy}px`);
        };
        const onUp = () => {
            grip.removeEventListener('pointermove', onMove);
            grip.removeEventListener('pointerup', onUp);
            grip.removeEventListener('pointercancel', onUp);
        };
        grip.addEventListener('pointermove', onMove);
        grip.addEventListener('pointerup', onUp);
        grip.addEventListener('pointercancel', onUp);
    }, [enabled]);
    // Modeless card drag: header moves the card via left/top (fixed position).
    const modelessRef = (0, react_1.useRef)(null);
    const onModelessHeaderPointerDown = (0, react_1.useCallback)((event) => {
        if (event.button !== 0)
            return;
        const card = modelessRef.current;
        const header = event.currentTarget;
        if (!card)
            return;
        event.preventDefault();
        header.setPointerCapture(event.pointerId);
        const rect = card.getBoundingClientRect();
        const grabX = event.clientX - rect.left;
        const grabY = event.clientY - rect.top;
        const onMove = (e) => {
            const x = Math.min(Math.max(e.clientX - grabX, 8), Math.max(8, window.innerWidth - rect.width - 8));
            const y = Math.min(Math.max(e.clientY - grabY, 8), Math.max(8, window.innerHeight - 48));
            card.style.left = `${x}px`;
            card.style.top = `${y}px`;
            card.style.right = 'auto';
        };
        const onUp = () => {
            header.removeEventListener('pointermove', onMove);
            header.removeEventListener('pointerup', onUp);
            header.removeEventListener('pointercancel', onUp);
        };
        header.addEventListener('pointermove', onMove);
        header.addEventListener('pointerup', onUp);
        header.addEventListener('pointercancel', onUp);
    }, []);
    // Modeless presentation (desktop scope only): a floating card, not a modal.
    if (enabled && modeless) {
        return ((0, jsx_runtime_1.jsxs)("div", { ref: modelessRef, role: "dialog", "aria-label": label, "data-qc-component": "C53", className: "qc-modeless-card qc-hosted-dialog", children: [(0, jsx_runtime_1.jsxs)("div", { className: "qc-modeless-header", onPointerDown: onModelessHeaderPointerDown, children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-modeless-grip", "aria-hidden": "true" }), (0, jsx_runtime_1.jsx)("span", { className: "qc-modeless-label", children: label })] }), (0, jsx_runtime_1.jsx)("div", { className: "qc-modeless-body", children: children })] }));
    }
    // In the enabled (native dialog) presentation the legacy wrapper classes are
    // viewport-overlay mechanics (fixed inset-0 backdrop/centering) that break
    // hit-testing inside a native <dialog>: content painted outside the dialog
    // box cannot receive pointer events, which made lower form rows (confirm
    // buttons) unclickable. Strip overlay/positioning utilities; keep the rest.
    const overlayMechanics = new Set(['fixed', 'inset-0', 'flex', 'items-center', 'justify-center', 'bg-black/50', 'bg-black/40', 'z-40', 'z-50', 'z-[60]']);
    const retained = className.split(/\s+/).filter(Boolean).filter((cls) => !overlayMechanics.has(cls) && !/^z-\d+$/.test(cls) && !/^inset-/.test(cls)).join(' ');
    if (!enabled)
        return ((0, jsx_runtime_1.jsxs)("div", { ...legacyProps, className: `${className}${floating ? ' qc-hosted-floating-legacy' : ''}`, children: [floating && (0, jsx_runtime_1.jsx)("div", { onPointerDown: onGripPointerDown, className: "qc-hosted-floating-grip", "aria-hidden": "true" }), children] }));
    return (0, jsx_runtime_1.jsxs)(QcDialog_1.QcDialog, { open: true, labelledBy: nameId, size: size, pending: pending || !onRequestClose, onRequestClose: onRequestClose ?? (() => { }), className: floating ? 'qc-hosted-dialog qc-hosted-floating' : 'qc-hosted-dialog', children: [(0, jsx_runtime_1.jsx)("span", { id: nameId, className: "qc-hosted-dialog-name", children: label }), floating && (0, jsx_runtime_1.jsx)("div", { onPointerDown: onGripPointerDown, className: "qc-hosted-floating-grip", "aria-hidden": "true" }), (0, jsx_runtime_1.jsx)("div", { ...legacyProps, role: undefined, "aria-modal": undefined, "aria-labelledby": undefined, "data-qc-component": "C53", className: `qc-hosted-dialog-content ${retained}`, children: children })] });
}
/** C01 adapter. Preserve native default submit semantics and legacy classes
 * outside the explicitly reviewed scope. No implicit disabled/pending guards. */
exports.QcHostedButton = (0, react_1.forwardRef)(function QcHostedButton({ variant = 'ghost', size, pending, ...props }, ref) {
    const enabled = (0, react_1.useContext)(HostedDialogPresentation);
    if (!enabled)
        return (0, jsx_runtime_1.jsx)("button", { ...props, ref: ref });
    return (0, jsx_runtime_1.jsx)(QcButton_1.QcButton, { ...props, ref: ref, type: props.type ?? 'submit', variant: variant, size: size, pending: pending });
});

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-hosted-dialog.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-journeys.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/qc-library.css":function(require,module,exports){

},"/mnt/data/pricing_activation_work/quotecore-plus/app/(auth)/[workspaceSlug]/components/components/AddFromCatalogModal.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFromCatalogModal = AddFromCatalogModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const QcJourney_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcJourney.tsx");
const react_1 = require("react");
const catalog_actions_1 = require("@catalogue");
require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/pricing/pricing-activation.css");
const MAX_ROWS = 20;
const NAME_CHAR_LIMIT = 60;
// Field-first mapping: each component field gets a dropdown of catalog columns.
// Only `name` is required. The columnMapping state stays Record<string, string[]>
// (header -> fields[]) for backend compatibility.
const MAPPABLE_FIELDS = [
    { value: 'name', label: 'Component Name', required: true, placeholder: 'Select a column...' },
    { value: 'sku', label: 'SKU / Product Code', required: false, placeholder: 'Select a column...' },
    { value: 'price', label: 'Material cost', required: false, placeholder: 'Select a column...' },
    { value: 'notes', label: 'Description / Notes', required: false, placeholder: 'Select a column...' },
];
function AddFromCatalogModal({ workspaceSlug, collections, onClose, onCreated, }) {
    const [step, setStep] = (0, react_1.useState)('select-catalog');
    const [tab, setTab] = (0, react_1.useState)('my-catalogs');
    // Catalog lists
    const [myCatalogs, setMyCatalogs] = (0, react_1.useState)([]);
    const [publicCatalogs, setPublicCatalogs] = (0, react_1.useState)([]);
    const [loadingCatalogs, setLoadingCatalogs] = (0, react_1.useState)(false);
    const [searchQuery, setSearchQuery] = (0, react_1.useState)('');
    // Selected catalog rows
    const [headers, setHeaders] = (0, react_1.useState)([]);
    const [allRows, setAllRows] = (0, react_1.useState)([]);
    const [loadingRows, setLoadingRows] = (0, react_1.useState)(false);
    const [rowSearchFilter, setRowSearchFilter] = (0, react_1.useState)('');
    // Column mapping - stored as Record<string, string[]> (header -> fields[]) for backend compat,
    // but the UI is field-first: user picks a column for each field via dropdown.
    const [columnMapping, setColumnMapping] = (0, react_1.useState)({});
    // fieldToHeader: which catalog column is assigned to each field (field -> header | '')
    const [fieldToHeader, setFieldToHeader] = (0, react_1.useState)({});
    // Row selection
    const [selectedRowIndices, setSelectedRowIndices] = (0, react_1.useState)(new Set());
    // Incremental rendering for large catalogs
    const VISIBLE_INCREMENT = 500;
    const SEARCH_RENDER_LIMIT = 500;
    const [visibleCount, setVisibleCount] = (0, react_1.useState)(VISIBLE_INCREMENT);
    const sentinelRef = (0, react_1.useRef)(null);
    const loadingMoreRef = (0, react_1.useRef)(false);
    // Destination
    const [destMode, setDestMode] = (0, react_1.useState)('existing');
    const [existingCollectionId, setExistingCollectionId] = (0, react_1.useState)(collections.find(c => c.is_bootstrap)?.id ?? collections[0]?.id ?? '');
    const [newLibraryName, setNewLibraryName] = (0, react_1.useState)('');
    // Result
    const [error, setError] = (0, react_1.useState)(null);
    const [createdCount, setCreatedCount] = (0, react_1.useState)(0);
    // ── Load catalogs on mount ──────────────────────────────────────────
    const loadMyCatalogs = (0, react_1.useCallback)(async (isCurrent = () => true) => {
        setLoadingCatalogs(true);
        setError(null);
        try {
            const result = await (0, catalog_actions_1.listUserCatalogs)();
            if (isCurrent())
                setMyCatalogs(result);
        }
        catch {
            if (isCurrent())
                setError('Failed to load your catalogs.');
        }
        finally {
            if (isCurrent())
                setLoadingCatalogs(false);
        }
    }, []);
    const loadPublicCatalogs = (0, react_1.useCallback)(async (q) => {
        setLoadingCatalogs(true);
        try {
            const result = await (0, catalog_actions_1.searchPublicCatalogs)({ query: q });
            setPublicCatalogs(result);
        }
        catch {
            setError('Failed to load supplier catalogs.');
        }
        finally {
            setLoadingCatalogs(false);
        }
    }, []);
    // P6-CATALOG-01 resolved: no network effects during render. Server-action
    // requests cannot be aborted, so ignore a stale mount (including Strict Mode replay).
    (0, react_1.useEffect)(() => {
        let current = true;
        void loadMyCatalogs(() => current);
        return () => { current = false; };
    }, [loadMyCatalogs]);
    // ── Catalog selection ───────────────────────────────────────────────
    async function handleCatalogClick(catalogId, catalogHeaders) {
        setLoadingRows(true);
        setError(null);
        setStep('view-rows');
        try {
            const res = await fetch('/api/catalog-rows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ catalogId }),
            });
            const result = await res.json();
            if (result.ok && result.headers && result.rows) {
                setHeaders(result.headers);
                setAllRows(result.rows);
                // Auto-map: build fieldToHeader by matching header names to known field patterns
                const autoFieldMap = {};
                for (const h of result.headers) {
                    const lower = h.toLowerCase().trim();
                    if (!autoFieldMap.sku && (lower === 'sku' || lower === 'code' || lower === 'product code' || lower === 'item code')) {
                        autoFieldMap.sku = h;
                    }
                    if (!autoFieldMap.name && (lower === 'name' || lower === 'product' || lower === 'product name' || lower === 'item name' || lower === 'item' || lower === 'description')) {
                        autoFieldMap.name = h;
                    }
                    if (!autoFieldMap.price && (lower === 'price' || lower === 'cost' || lower === 'rate' || lower === 'unit price' || lower === 'buy price')) {
                        autoFieldMap.price = h;
                    }
                    if (!autoFieldMap.notes && (lower === 'notes' || lower === 'note' || lower === 'description' || lower === 'desc')) {
                        autoFieldMap.notes = h;
                    }
                }
                setFieldToHeader(autoFieldMap);
                // Sync columnMapping for backend compat
                const autoColMap = {};
                for (const h of result.headers)
                    autoColMap[h] = [];
                for (const [field, header] of Object.entries(autoFieldMap)) {
                    if (header && autoColMap[header])
                        autoColMap[header].push(field);
                }
                setColumnMapping(autoColMap);
                // Default: select first MAX_ROWS rows
                setSelectedRowIndices(new Set(result.rows.slice(0, MAX_ROWS).map((_, i) => i)));
            }
            else {
                setError(result.error ?? 'Failed to load catalog rows.');
                setStep('select-catalog');
            }
        }
        catch {
            setError('Network error loading catalog.');
            setStep('select-catalog');
        }
        finally {
            setLoadingRows(false);
        }
    }
    // ── Field mapping change handler ───────────────────────────────────
    function handleFieldMappingChange(field, header) {
        setFieldToHeader(prev => {
            const next = { ...prev };
            if (header) {
                next[field] = header;
            }
            else {
                delete next[field];
            }
            // Sync columnMapping (header -> fields[]) for backend
            setColumnMapping(() => {
                const colMap = {};
                for (const h of headers)
                    colMap[h] = [];
                for (const [f, hdr] of Object.entries(next)) {
                    if (hdr && colMap[hdr])
                        colMap[hdr].push(f);
                }
                return colMap;
            });
            return next;
        });
    }
    // ── Row selection ───────────────────────────────────────────────────
    function toggleRow(idx) {
        setSelectedRowIndices(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            }
            else {
                if (next.size >= MAX_ROWS)
                    return next; // Cap at MAX_ROWS
                next.add(idx);
            }
            return next;
        });
    }
    function toggleAllFiltered(filteredIndices) {
        const allFilteredSelected = filteredIndices.every(i => selectedRowIndices.has(i));
        setSelectedRowIndices(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                // Deselect all filtered
                for (const i of filteredIndices)
                    next.delete(i);
            }
            else {
                // Select all filtered up to MAX_ROWS total
                for (const i of filteredIndices) {
                    if (next.size >= MAX_ROWS)
                        break;
                    next.add(i);
                }
            }
            return next;
        });
    }
    // ── Destination + Create ────────────────────────────────────────────
    async function handleCreate() {
        const rows = allRows.filter((_, i) => selectedRowIndices.has(i));
        if (rows.length === 0) {
            setError('Select at least one row.');
            return;
        }
        const allMappedFields = Object.values(columnMapping).flat();
        const hasName = allMappedFields.includes('name');
        if (!hasName) {
            setError('Please select a column for Component Name.');
            return;
        }
        if (destMode === 'new' && !newLibraryName.trim()) {
            setError('Enter a name for the new library.');
            return;
        }
        if (destMode === 'existing' && !existingCollectionId) {
            setError('Select a target library.');
            return;
        }
        setStep('creating');
        setError(null);
        try {
            const result = await (0, catalog_actions_1.convertCatalogRowsToComponents)({
                targetCollectionId: destMode === 'existing' ? existingCollectionId : '',
                newLibraryName: destMode === 'new' ? newLibraryName.trim() : undefined,
                selectedRows: rows,
                columnMapping,
            });
            if (result.ok) {
                setCreatedCount(result.created ?? 0);
                setStep('success');
                onCreated();
            }
            else {
                setError(result.errors?.[0] ?? 'Conversion failed.');
                setStep('destination');
            }
        }
        catch {
            setError('Network error. Please try again.');
            setStep('destination');
        }
    }
    function handleReset() {
        setStep('select-catalog');
        setHeaders([]);
        setAllRows([]);
        setColumnMapping({});
        setFieldToHeader({});
        setSelectedRowIndices(new Set());
        setError(null);
        setCreatedCount(0);
        setRowSearchFilter('');
        setNewLibraryName('');
        setDestMode('existing');
        setVisibleCount(VISIBLE_INCREMENT);
    }
    // Filtered rows for display
    const filteredRowData = (0, react_1.useMemo)(() => {
        return allRows
            .map((row, i) => ({ row, i }))
            .filter(({ row }) => {
            if (!rowSearchFilter)
                return true;
            return Object.values(row).some(v => String(v ?? '').toLowerCase().includes(rowSearchFilter.toLowerCase()));
        });
    }, [allRows, rowSearchFilter]);
    // Only render visible rows for performance with large catalogs
    // When searching, show up to SEARCH_RENDER_LIMIT since filtered results are smaller
    const effectiveLimit = rowSearchFilter ? SEARCH_RENDER_LIMIT : visibleCount;
    const visibleRowData = filteredRowData.slice(0, effectiveLimit);
    const filteredIndices = filteredRowData.map(d => d.i);
    // Show the SAME source row, not guessed parsed rates or invented pack rules.
    const exampleIndex = allRows.findIndex((_, index) => selectedRowIndices.has(index));
    const exampleRow = exampleIndex >= 0 ? allRows[exampleIndex] : undefined;
    // Set of headers that are currently mapped to a field (for column highlighting)
    const mappedHeaders = (0, react_1.useMemo)(() => {
        const s = new Set();
        for (const v of Object.values(fieldToHeader)) {
            if (v)
                s.add(v);
        }
        return s;
    }, [fieldToHeader]);
    // Reset visible count when filter or rows change
    (0, react_1.useEffect)(() => {
        setVisibleCount(VISIBLE_INCREMENT);
    }, [rowSearchFilter, allRows]);
    // Auto-load more rows when sentinel is visible (infinite scroll)
    // Guard with loadingMoreRef to prevent rapid-fire cascades
    (0, react_1.useEffect)(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel)
            return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && !loadingMoreRef.current) {
                loadingMoreRef.current = true;
                setVisibleCount(c => c + VISIBLE_INCREMENT);
                // Allow next batch after a short delay for DOM to settle
                setTimeout(() => { loadingMoreRef.current = false; }, 150);
            }
        }, { rootMargin: '0px', threshold: 0.1 });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [visibleCount, rowSearchFilter, filteredRowData.length]);
    return ((0, jsx_runtime_1.jsx)(QcJourney_1.QcJourneyDialog, { label: "Create components from catalogue", size: "lg", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 max-h-[90vh] flex flex-col", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-slate-900", children: "Create components from a catalogue" }), (0, jsx_runtime_1.jsx)("p", { className: "qc-flow-description mb-0", children: "One row becomes one basic component. Match columns, choose rows, then review the pricing rules in your library." })] }), (0, jsx_runtime_1.jsx)("button", { "aria-label": step === 'creating' ? 'Creating components, please wait' : 'Close catalogue import', onClick: onClose, disabled: step === 'creating', className: "qc-icon-button qc-flow-control text-slate-400 hover:text-slate-600 transition cursor-pointer", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "px-6 py-5 overflow-auto flex-1", children: [(0, jsx_runtime_1.jsx)(QcJourney_1.QcJourneySteps, { steps: ["Catalogue", "Fields & rows", "Library", "Create"], current: step === 'select-catalog' ? 0 : step === 'view-rows' ? 1 : step === 'destination' ? 2 : 3, label: "Component creation progress" }), error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 mb-4", children: error })), step === 'select-catalog' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => { setTab('my-catalogs'); void loadMyCatalogs(); }, className: "qc-flow-control " + (`px-4 py-1.5 text-xs font-medium rounded-full border transition ${tab === 'my-catalogs'
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`), children: "My Catalogs" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => { setTab('supplier-catalogs'); void loadPublicCatalogs(searchQuery); }, className: "qc-flow-control " + (`px-4 py-1.5 text-xs font-medium rounded-full border transition ${tab === 'supplier-catalogs'
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`), children: "Supplier Catalogs" })] }), tab === 'supplier-catalogs' && ((0, jsx_runtime_1.jsxs)("div", { className: "relative", children: [(0, jsx_runtime_1.jsx)("svg", { className: "absolute left-3 top-2.5 w-4 h-4 text-slate-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }), (0, jsx_runtime_1.jsx)("input", { "aria-label": "Search by keyword, brand, location, roofing type...", type: "text", value: searchQuery, onChange: e => setSearchQuery(e.target.value), onKeyDown: e => { if (e.key === 'Enter')
                                                void loadPublicCatalogs(searchQuery); }, placeholder: "Search by keyword, brand, location, roofing type...", className: "qc-input qc-flow-search w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none" })] })), loadingCatalogs ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2", children: "Loading catalogs..." })] })) : tab === 'my-catalogs' ? (myCatalogs.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: "No catalogs uploaded yet." }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-1", children: "Upload a CSV catalogue in Resources, then return here to choose the rows you need." })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: myCatalogs.map(cat => ((0, jsx_runtime_1.jsx)("button", { onClick: () => handleCatalogClick(cat.id, cat.headers), className: "qc-flow-control qc-flow-card block w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-slate-900 truncate", children: cat.name }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400 mt-0.5", children: [cat.row_count, " rows ", cat.original_filename ? `- ${cat.original_filename}` : ''] })] }), (0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4 text-slate-300 group-hover:text-orange-400 transition flex-shrink-0 ml-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })] }) }, cat.id))) }))) : (publicCatalogs.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: "No supplier catalogs found." }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-1", children: "Try a different search or check back later." })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-2", children: publicCatalogs.map(cat => ((0, jsx_runtime_1.jsx)("button", { onClick: () => handleCatalogClick(cat.id, cat.headers), className: "qc-flow-control qc-flow-card block w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "min-w-0", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-slate-900 truncate", children: cat.public_title || cat.name }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400 mt-0.5", children: [cat.supplier_name, " - ", cat.row_count, " rows", cat.brands && cat.brands.length > 0 && ` - ${cat.brands.join(', ')}`] }), cat.public_description && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500 mt-1 line-clamp-2", children: cat.public_description }))] }), (0, jsx_runtime_1.jsx)("svg", { className: "w-4 h-4 text-slate-300 group-hover:text-orange-400 transition flex-shrink-0 ml-2", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })] }) }, cat.id))) })))] })), step === 'view-rows' && ((0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: loadingRows ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2", children: "Loading catalog rows..." })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-slate-200 overflow-hidden", children: [(0, jsx_runtime_1.jsxs)("div", { className: "bg-slate-50 border-b border-slate-200 px-4 py-2.5", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-medium text-slate-600", children: "Map your catalog columns to component fields" }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-400 mt-0.5", children: "Only Component Name is required. Suggested matches are a starting point: check what each column contains." })] }), (0, jsx_runtime_1.jsx)("div", { className: "divide-y divide-slate-100", children: MAPPABLE_FIELDS.map(field => {
                                                    const selectedHeader = fieldToHeader[field.value] ?? '';
                                                    const isNameUnset = field.required && !selectedHeader;
                                                    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between px-4 py-2.5 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1.5 min-w-0", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-medium text-slate-700", children: field.label }), field.required && (0, jsx_runtime_1.jsx)("span", { className: "text-red-500 text-xs", children: "*" }), isNameUnset && ((0, jsx_runtime_1.jsx)("span", { className: "text-[10px] text-orange-500 font-medium", children: "required" }))] }), (0, jsx_runtime_1.jsxs)("select", { value: selectedHeader, "aria-label": `Column for ${field.label}`, onChange: e => handleFieldMappingChange(field.value, e.target.value), className: "qc-select " + (`text-xs rounded-lg border px-2 py-1.5 focus:border-orange-500 focus:outline-none min-w-[140px] ${isNameUnset
                                                                    ? 'border-orange-300 ring-1 ring-orange-200'
                                                                    : 'border-slate-300'}`), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: field.placeholder }), headers.map(h => ((0, jsx_runtime_1.jsx)("option", { value: h, children: h }, h)))] })] }, field.value));
                                                }) })] }), (0, jsx_runtime_1.jsxs)("section", { className: "qc-catalogue-example", "aria-label": "Example component from selected row", children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsx)("span", { className: "qc-eyebrow", children: "Your row \u2192 a Smart Component" }), (0, jsx_runtime_1.jsx)("h3", { children: exampleRow ? `Example from row ${exampleIndex + 1}` : 'Select a row to see an example' })] }), exampleRow && (0, jsx_runtime_1.jsx)("dl", { children: MAPPABLE_FIELDS.map(field => (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("dt", { children: [field.label, (0, jsx_runtime_1.jsx)("small", { children: fieldToHeader[field.value] ? `From “${fieldToHeader[field.value]}”` : 'Not mapped' })] }), (0, jsx_runtime_1.jsx)("dd", { children: fieldToHeader[field.value] ? (String(exampleRow[fieldToHeader[field.value]] ?? '') || 'Empty in this row') : 'Not supplied' })] }, field.value)) }), (0, jsx_runtime_1.jsx)("p", { children: "These are your selected source values. After import, check measurement, labour, waste and pitch. Roll or pack prices also need purchasing settings." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "relative flex-1 max-w-xs", children: [(0, jsx_runtime_1.jsx)("svg", { className: "absolute left-3 top-2.5 w-4 h-4 text-slate-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" }) }), (0, jsx_runtime_1.jsx)("input", { "aria-label": "Filter rows...", type: "text", value: rowSearchFilter, onChange: e => setRowSearchFilter(e.target.value), placeholder: "Filter rows...", className: "qc-input qc-flow-search w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none" })] }), (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-500 whitespace-nowrap", children: [selectedRowIndices.size, "/", MAX_ROWS, " selected", selectedRowIndices.size >= MAX_ROWS && (0, jsx_runtime_1.jsx)("span", { className: "text-orange-500 ml-1", children: "(max reached)" }), (0, jsx_runtime_1.jsxs)("span", { className: "text-slate-300 ml-2", children: ["- ", allRows.length.toLocaleString(), " rows loaded"] }), rowSearchFilter && filteredRowData.length > SEARCH_RENDER_LIMIT && ((0, jsx_runtime_1.jsxs)("span", { className: "text-orange-400 ml-1", children: ["(showing first ", SEARCH_RENDER_LIMIT, " matches)"] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "qc-flow-selection-summary", role: "status", children: [(0, jsx_runtime_1.jsxs)("strong", { children: [selectedRowIndices.size, " of ", MAX_ROWS, " rows selected"] }), (0, jsx_runtime_1.jsx)("span", { children: rowSearchFilter
                                                    ? `${Array.from(selectedRowIndices).filter(index => !filteredIndices.includes(index)).length} selected outside this filter`
                                                    : 'Up to the first 20 rows are selected initially. Change the checkboxes to choose your own.' })] }), (0, jsx_runtime_1.jsx)("div", { className: "qc-flow-scroll rounded-lg border border-slate-200 overflow-auto max-h-[40vh]", tabIndex: 0, role: "region", "aria-label": "Catalogue rows", children: (0, jsx_runtime_1.jsxs)("table", { className: "qc-flow-table min-w-max", children: [(0, jsx_runtime_1.jsx)("thead", { className: "sticky top-0 z-10 bg-white", children: (0, jsx_runtime_1.jsxs)("tr", { className: "border-b border-slate-200", children: [(0, jsx_runtime_1.jsx)("th", { className: "px-2 py-2 text-left w-8", children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", "aria-label": "Select matching rows, up to 20 total", checked: filteredIndices.length > 0 && filteredIndices.every(i => selectedRowIndices.has(i)), onChange: () => toggleAllFiltered(filteredIndices), className: "qc-check cursor-pointer" }) }), headers.map(h => {
                                                                const isMapped = mappedHeaders.has(h);
                                                                return ((0, jsx_runtime_1.jsxs)("th", { className: `px-2 py-2 text-left font-medium whitespace-nowrap ${isMapped ? 'bg-orange-50/60 text-slate-900' : 'bg-white text-slate-600'}`, children: [h, (columnMapping[h] ?? []).length > 0 && ((0, jsx_runtime_1.jsxs)("span", { className: "ml-1 text-xs text-orange-500 font-semibold", children: ["(", columnMapping[h].join(', '), ")"] }))] }, h));
                                                            })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-slate-50", children: visibleRowData.map(({ row, i }) => ((0, jsx_runtime_1.jsxs)("tr", { className: `cursor-pointer`, onClick: () => toggleRow(i), children: [(0, jsx_runtime_1.jsx)("td", { className: `px-2 py-1.5 ${selectedRowIndices.has(i) ? 'bg-orange-50/20' : ''}`, onClick: e => e.stopPropagation(), children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", "aria-label": `Select catalogue row ${i + 1}`, checked: selectedRowIndices.has(i), onChange: () => toggleRow(i), className: "qc-check cursor-pointer" }) }), headers.map(h => ((0, jsx_runtime_1.jsx)("td", { style: mappedHeaders.has(h) ? undefined : { backgroundColor: '#ffffff' }, className: `px-2 py-1.5 whitespace-nowrap ${mappedHeaders.has(h)
                                                                    ? (selectedRowIndices.has(i) ? 'bg-orange-50/70 text-slate-700' : 'bg-orange-50/50 text-slate-700')
                                                                    : 'text-slate-600'}`, children: row[h] ?? '-' }, h)))] }, i))) })] }) }), !rowSearchFilter && visibleCount < filteredRowData.length ? ((0, jsx_runtime_1.jsx)("div", { ref: sentinelRef, className: "text-center py-2", children: (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-400", children: ["Loading more rows... (", (filteredRowData.length - visibleCount).toLocaleString(), " remaining)"] }) })) : !rowSearchFilter && visibleCount >= filteredRowData.length && filteredRowData.length > VISIBLE_INCREMENT ? ((0, jsx_runtime_1.jsx)("div", { className: "text-center py-1", children: (0, jsx_runtime_1.jsxs)("span", { className: "text-xs text-slate-300", children: ["Showing all ", filteredRowData.length.toLocaleString(), " rows"] }) })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", onClick: handleReset, className: "qc-flow-control qc-button px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition cursor-pointer", children: "Back" }), (0, jsx_runtime_1.jsxs)("button", { "data-qc-variant": "primary", onClick: () => {
                                                    const allMappedFields = Object.values(columnMapping).flat();
                                                    const hasName = allMappedFields.includes('name');
                                                    if (!hasName) {
                                                        setError('Please select a column for Component Name.');
                                                        return;
                                                    }
                                                    if (selectedRowIndices.size === 0) {
                                                        setError('Select at least one row.');
                                                        return;
                                                    }
                                                    setError(null);
                                                    setStep('destination');
                                                }, disabled: selectedRowIndices.size === 0, className: "qc-flow-control qc-button px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer", children: ["Next: Choose Library (", selectedRowIndices.size, " selected)"] })] })] })) })), step === 'destination' && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-5", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-slate-900 mb-3", children: "Choose destination library" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 mb-4", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => setDestMode('existing'), className: "qc-flow-control " + (`px-4 py-1.5 text-xs font-medium rounded-full border transition ${destMode === 'existing'
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`), children: "Existing Library" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setDestMode('new'), className: "qc-flow-control " + (`px-4 py-1.5 text-xs font-medium rounded-full border transition ${destMode === 'new'
                                                        ? 'bg-slate-900 text-white border-slate-900'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`), children: "Create New Library" })] }), destMode === 'existing' ? ((0, jsx_runtime_1.jsx)("select", { "aria-label": "Destination library", value: existingCollectionId, onChange: e => setExistingCollectionId(e.target.value), className: "qc-select w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none", children: collections.map(col => ((0, jsx_runtime_1.jsxs)("option", { value: col.id, children: [col.name, col.is_bootstrap ? ' (Default)' : '', col.component_count != null ? ` - ${col.component_count} components` : ''] }, col.id))) })) : ((0, jsx_runtime_1.jsx)("input", { "aria-label": "New library name...", type: "text", value: newLibraryName, onChange: e => setNewLibraryName(e.target.value), placeholder: "New library name...", className: "qc-input w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" }))] }), (0, jsx_runtime_1.jsxs)("p", { className: "qc-flow-callout", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Destination:" }), " ", destMode === 'new' ? (newLibraryName || 'Name your new library above') : (collections.find(collection => collection.id === existingCollectionId)?.name || 'Choose a library above'), ". Your source catalogue is not changed."] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-slate-200 bg-slate-50 px-4 py-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500 mb-1", children: "Summary" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-700", children: ["Creating ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold", children: selectedRowIndices.size }), " component", selectedRowIndices.size !== 1 ? 's' : '', " from catalog rows."] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-1", children: "Each selected row creates a basic record. Check measurement type, material units and costs, labour, purchasing and allowances before quoting. Missing prices must be reviewed." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", onClick: () => setStep('view-rows'), className: "qc-flow-control qc-button px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition cursor-pointer", children: "Back" }), (0, jsx_runtime_1.jsxs)("button", { "data-qc-variant": "primary", onClick: handleCreate, className: "qc-flow-control qc-button px-5 py-2 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition cursor-pointer", children: ["Create ", selectedRowIndices.size, " Component", selectedRowIndices.size !== 1 ? 's' : ''] })] })] })), step === 'creating' && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-12", children: [(0, jsx_runtime_1.jsx)("div", { className: "inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500", children: "Creating components..." })] })), step === 'success' && ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-8", children: [(0, jsx_runtime_1.jsx)("div", { className: "inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-4", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-6 h-6 text-emerald-600", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm font-semibold text-slate-900", children: ["Created ", createdCount, " component", createdCount !== 1 ? 's' : '', " successfully."] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400 mt-1 mb-6", children: "The basic records are saved. Open them to check measurement type, purchasing, labour, waste and pitch, then use Test component before quoting." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 justify-center", children: [(0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "ghost", onClick: handleReset, className: "qc-flow-control qc-button px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition cursor-pointer", children: "Import more" }), (0, jsx_runtime_1.jsx)("button", { "data-qc-variant": "primary", onClick: onClose, className: "qc-flow-control qc-button px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition cursor-pointer", children: "Review components" })] })] }))] })] }) }));
}

},"@catalogue":function(require,module,exports){
exports.listUserCatalogs=async()=>[{id:'cat-1',file_name:'Supplier-price-list.csv',name:'Supplier price list',row_count:3,headers:['Product','Code','Cost','Notes'],created_at:'2026-09-28'}];exports.searchPublicCatalogs=async()=>[];exports.convertCatalogRowsToComponents=async input=>{window.fixtureCalls.push({kind:'convert',input});if(window.fixtureFail)return {ok:false,errors:['Fixture import failure']};await new Promise(r=>setTimeout(r,window.fixtureDelay||0));return {ok:true,created:input.selectedRows.length}};
},"/mnt/data/pricing_activation_work/quotecore-plus/app/components/UpgradeModal.tsx":function(require,module,exports){
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeModal = UpgradeModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const QcHostedDialog_1 = require("/mnt/data/pricing_activation_work/quotecore-plus/app/components/ui/v2/QcHostedDialog.tsx");
const react_1 = require("react");
const link_1 = require("next/link");
const navigation_1 = require("next/navigation");
/**
 * Reusable "you've hit a tier gate" modal. Replaces the previous mix of
 * native alert()s and bespoke per-gate dialogs.
 *
 * Usage pattern from any client component:
 *
 *   const [upgradeOpen, setUpgradeOpen] = useState(false);
 *   ...
 *   <UpgradeModal
 *     open={upgradeOpen}
 *     onClose={() => setUpgradeOpen(false)}
 *     title="Digital takeoff requires a paid plan"
 *     description="Upgrade your account to draw measurements on imported roof plans."
 *     recommendedPlan="growth"
 *   />
 *
 * The "View plans" button navigates to /<workspaceSlug>/account?tab=billing
 * with `&plan=<recommendedPlan>` so the upgrade-card with that code can be
 * highlighted server-side.
 */
function UpgradeModal({ open, title, description, recommendedPlan, ctaLabel = 'View plans', closeLabel = 'Not now', onClose, }) {
    const params = (0, navigation_1.useParams)();
    // Workspace slug is part of every authenticated route; fall back to '/' if
    // we're somehow rendered outside the workspace shell (shouldn't happen).
    const slug = typeof params?.workspaceSlug === 'string' ? params.workspaceSlug : '';
    const href = slug
        ? `/${slug}/account?tab=billing${recommendedPlan ? `&plan=${recommendedPlan}` : ''}`
        : `/account?tab=billing${recommendedPlan ? `&plan=${recommendedPlan}` : ''}`;
    // Close on Escape so keyboard users aren't trapped.
    (0, react_1.useEffect)(() => {
        if (!open)
            return;
        function onKey(e) {
            if (e.key === 'Escape')
                onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open)
        return null;
    return ((0, jsx_runtime_1.jsx)(QcHostedDialog_1.QcHostedDialog, { label: title, size: "sm", className: "fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50 p-4", role: "dialog", "aria-modal": "true", "aria-labelledby": "upgrade-modal-title", children: (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m0 0v.01M12 9v.01M12 3l9 16H3l9-16z" }) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsx)("h3", { id: "upgrade-modal-title", className: "text-lg font-semibold text-slate-900", children: title }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-500 mt-2 whitespace-pre-line break-words", children: description })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 justify-end mt-6", children: [(0, jsx_runtime_1.jsx)(QcHostedDialog_1.QcHostedButton, { variant: "ghost", type: "button", onClick: onClose, className: "px-4 py-2 text-sm font-medium rounded-full text-slate-700 hover:bg-slate-100", children: closeLabel }), (0, jsx_runtime_1.jsx)(link_1.default, { href: href, onClick: onClose, className: "px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800", children: ctaLabel })] })] }) }));
}

},"next/navigation":function(require,module,exports){
exports.useParams=()=>({workspaceSlug:'sample-roofing'});exports.useRouter=()=>({push:p=>window.fixtureCalls.push({kind:'push',path:p}),refresh:()=>window.fixtureCalls.push({kind:'refresh'})});
},"/mnt/data/pricing_activation_work/quotecore-plus/app/lib/trades/labels.ts":function(require,module,exports){
"use strict";
/**
 * Trade-aware UI labels - single source of truth for all copy that varies by trade.
 *
 * Each new trade is one entry in TRADE_LABELS plus an enum value in the DB.
 * The rest of the UI picks up the right copy automatically via getTradeLabels().
 *
 * Fields are grouped by usage context: area labels, modal copy, takeoff
 * instructions, quote builder, customer quote, measurement type overrides.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADE_LABELS = void 0;
exports.getTradeLabels = getTradeLabels;
exports.TRADE_LABELS = {
    plumbing: {
        tradeLabel: 'Plumbing',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Bathroom, Kitchen, Ground Floor',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Job Areas',
        firstAreaInstructionsBody: 'You can optionally draw areas to break the job into zones (floors, rooms, sections). ' +
            'Or skip this and measure pipe runs and fittings directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Line / Multi-Line tools for pipe runs. ' +
            'Use the Curved Line tool for curved or concealed pipe routes. ' +
            'Use Point for fixtures, valves, and fittings.',
        needAreaPrompt: 'Do you want to define a job area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Plumbing Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Pipe Runs',
            curved_line: 'Curved Pipe Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume',
        },
    },
    electrical: {
        tradeLabel: 'Electrical',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Ground Floor, Roof Space',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Job Areas',
        firstAreaInstructionsBody: 'You can optionally draw areas to break the job into zones (floors, circuits, sections). ' +
            'Or skip this and measure cable runs and fittings directly.',
        firstAreaConfirmCta: "Yes, add an area",
        toolGuidanceNote: 'Use the Line / Multi-Line tools for cable runs and conduit. ' +
            'Use the Curved Line tool for curved cable paths. ' +
            'Use Point for outlets, fittings, and panels.',
        needAreaPrompt: 'Do you want to define a job area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Electrical Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Cable Runs',
            curved_line: 'Curved Cable Run',
            hours_days: 'Hours / Days',
            count: 'Count',
        },
    },
    roofing: {
        tradeLabel: 'Roofing',
        featureLabel: 'Flashings',
        featureLabelSingular: 'Flashing',
        areaPluralLabel: 'Roof Areas',
        areaSingularLabel: 'Roof Area',
        addAreaCta: 'Add Roof Area',
        pitchRequired: true,
        createAreaModalTitle: 'Create Roof Area',
        areaNamePlaceholder: 'e.g. Main Roof',
        areaIsOptional: false,
        firstAreaInstructionsTitle: 'Next: Create Your First Roof Area',
        firstAreaInstructionsBody: 'Before measuring components, you must define at least one roof area with a pitch angle. ' +
            'Click the Area button, draw around the roof outline, then enter a name and pitch angle.',
        firstAreaConfirmCta: "Got it, let's create a roof area!",
        toolGuidanceNote: null,
        needAreaPrompt: 'Do you want to measure a roof area first?',
        optionalAreaConfirmCta: 'Yes, add a roof area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Roof Areas',
        emptyAreaGuardMessage: 'A quote needs at least one roof area and one main component before it can be saved. ' +
            "We'll take you back to Roof Areas so you can add one.",
        customerQuoteSectionLabel: 'Roof Areas',
        measurementTypeLabels: {},
    },
    cladding: {
        tradeLabel: 'Cladding',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Wall Areas',
        areaSingularLabel: 'Wall Area',
        addAreaCta: 'Add Wall Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Wall Area',
        areaNamePlaceholder: 'e.g. North Elevation',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Next: Define Your Wall Areas',
        firstAreaInstructionsBody: 'Define your wall areas before measuring components. ' +
            'Use the Area tool to trace elevations directly, or use the Line / Multi-Line tools ' +
            'for plan views - make sure your components are set up with Wall Length × Height.',
        firstAreaConfirmCta: "Got it, let's add a wall area!",
        toolGuidanceNote: 'Use the Area tool for elevation plans, or the Line / Multi-Line tools for plan view ' +
            '(make sure your components are set up with Wall Length × Height).',
        needAreaPrompt: 'Do you want to measure a wall area first?',
        optionalAreaConfirmCta: 'Yes, add a wall area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Wall Areas',
        emptyAreaGuardMessage: 'A quote needs at least one wall area and one main component before it can be saved. ' +
            "We'll take you back to Wall Areas so you can add one.",
        customerQuoteSectionLabel: 'Wall Areas',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
        },
    },
    generic: {
        tradeLabel: 'Generic',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Zone A',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Areas',
        firstAreaInstructionsBody: 'For area-based components you can draw an area now. ' +
            'For lineal or count-based work you can skip this and measure directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: null,
        needAreaPrompt: 'Do you want to measure an area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one area and one main component before it can be saved. ' +
            "We'll take you back to Areas so you can add one.",
        customerQuoteSectionLabel: 'Areas',
        measurementTypeLabels: {},
    },
    landscaping: {
        tradeLabel: 'Landscaping',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Front Garden, Driveway, Patio',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Job Areas',
        firstAreaInstructionsBody: 'You can draw areas to break the job into zones (garden beds, paving, driveway, lawn). ' +
            'Or skip this and measure paths, edging, and items directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for gardens, lawns, paving, and decking. ' +
            'Use the Line / Multi-Line tools for paths, edging, retaining walls, and fence lines. ' +
            'Use the Curved Line tool for curved garden edges or winding paths. ' +
            'Use Point for trees, planters, fittings, and items priced per unit.',
        needAreaPrompt: 'Do you want to define a job area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Landscaping Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Lines',
            curved_line: 'Curved Line',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume',
            irregular_area: 'Irregular Area',
        },
    },
    flooring: {
        tradeLabel: 'Flooring',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Living Room, Hallway, Kitchen',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Floor Areas',
        firstAreaInstructionsBody: 'Draw each floor area you are quoting (room by room, or as a single open zone). ' +
            'Or skip this and measure components directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for room floor areas. ' +
            'Use the Line / Multi-Line tools for skirting, edge trims, and transition strips. ' +
            'Use Point for fittings and items priced per unit.',
        needAreaPrompt: 'Do you want to measure a floor area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Flooring Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Trim Runs',
            curved_line: 'Curved Trim Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume (screed / levelling)',
            irregular_area: 'Irregular Floor Area',
        },
    },
    tiling: {
        tradeLabel: 'Tiling',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Bathroom, Kitchen Splashback',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Tiling Areas',
        firstAreaInstructionsBody: 'Draw your tiling areas - floor zones from a plan, or walls measured directly. ' +
            'For wall tiling from a floor plan, use the Line / Multi-Line tools with components ' +
            'set up as Wall Length × Height.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for floor tiling and direct elevation plans. ' +
            'Use the Line / Multi-Line tools for wall runs in plan view ' +
            '(set components to Wall Length × Height). ' +
            'Use Point for fittings and items priced per unit.',
        needAreaPrompt: 'Do you want to measure a tiling area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Tiling Works',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
            multi_lineal: 'Multiple Trim Runs',
            curved_line: 'Curved Trim Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            irregular_area: 'Irregular Area',
        },
    },
    foundations: {
        tradeLabel: 'Foundations',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Main Slab, Garage Footing',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Foundation Areas',
        firstAreaInstructionsBody: 'Draw the slab outline or excavation footprint. ' +
            'Use the Line tools to trace footings, beams, and the perimeter directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for slab footprints and excavation zones. ' +
            'Use the Line / Multi-Line tools for footings, ring beams, and perimeter runs. ' +
            'Use Point for piers, pads, and items priced per unit.',
        needAreaPrompt: 'Do you want to measure a slab or excavation area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Foundation Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Footings',
            curved_line: 'Curved Footing',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume (concrete / excavation)',
            irregular_area: 'Irregular Slab Area',
        },
    },
    insulation: {
        tradeLabel: 'Insulation',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Ceiling, Loft, Wall North',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Insulation Areas',
        firstAreaInstructionsBody: 'Draw each area you are insulating - ceiling, floor, or walls. ' +
            'For wall insulation from a floor plan use the Line / Multi-Line tools with ' +
            'components set up as Wall Length × Height.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for ceiling, floor, and elevation areas. ' +
            'Use the Line / Multi-Line tools for wall insulation in plan view ' +
            '(set components to Wall Length × Height). ' +
            'Enable rafter pitch on roof / loft components that follow the slope.',
        needAreaPrompt: 'Do you want to measure an insulation area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Insulation Works',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
            multi_lineal: 'Multiple Edge Runs',
            hours_days: 'Hours / Days',
            count: 'Count (bags / rolls / batts)',
            irregular_area: 'Irregular Area',
        },
    },
    painting: {
        tradeLabel: 'Painting',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Living Room, External North Wall',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Painting Areas',
        firstAreaInstructionsBody: 'Draw each area you are painting - ceiling, walls, or external elevations. ' +
            'For wall painting from a floor plan use the Line / Multi-Line tools with ' +
            'components set up as Wall Length × Height.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for ceilings and direct elevation plans. ' +
            'Use the Line / Multi-Line tools for walls in plan view ' +
            '(set components to Wall Length × Height). ' +
            'Use the Line tools for skirtings, architraves, and trim.',
        needAreaPrompt: 'Do you want to measure a painting area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Painting Works',
        measurementTypeLabels: {
            multi_lineal_lxh: 'Wall Length × Height',
            length_x_height: 'Wall Height × Length',
            multi_lineal: 'Multiple Trim Runs',
            curved_line: 'Curved Trim Run',
            hours_days: 'Hours / Days',
            count: 'Count',
            irregular_area: 'Irregular Area',
        },
    },
    fencing: {
        tradeLabel: 'Fencing',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Boundary, Paddock',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Fencing Job',
        firstAreaInstructionsBody: 'For most fencing jobs you can skip the area step and measure fence runs directly. ' +
            'Or draw an area first if you want to record the enclosed zone.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Line / Multi-Line tools for fence runs. ' +
            'Use the Curved Line tool for curved boundaries. ' +
            'Use Point for posts, gates, and fittings priced per unit.',
        needAreaPrompt: 'Do you want to define an area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Fencing Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Fence Runs',
            multi_lineal_lxh: 'Panel Length × Height',
            length_x_height: 'Panel Height × Length',
            curved_line: 'Curved Fence Run',
            hours_days: 'Hours / Days',
            count: 'Count (posts / gates)',
            irregular_area: 'Irregular Area',
        },
    },
    concrete: {
        tradeLabel: 'Concrete',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Fall / Gradient (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Driveway, Garage Slab, Patio',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Concrete Areas',
        firstAreaInstructionsBody: 'Draw the slab or pour outline. ' +
            'Use the Line tools to trace kerbs, edges, expansion joints, and sawn cuts directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for slab footprints. ' +
            'Use the Line / Multi-Line tools for kerbs, edge restraints, joints, and sawn cuts. ' +
            'Use the Curved Line tool for curved kerbs and edges. ' +
            'Use Point for items priced per unit.',
        needAreaPrompt: 'Do you want to measure a slab area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Concrete Works',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Kerb / Edge Runs',
            curved_line: 'Curved Kerb / Edge',
            hours_days: 'Hours / Days',
            count: 'Count',
            volume: 'Volume (concrete pour)',
            irregular_area: 'Irregular Slab Area',
        },
    },
    solar: {
        tradeLabel: 'Solar',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Tilt (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Main Roof, North Array, Carport',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Installation Areas',
        firstAreaInstructionsBody: 'Draw each area where panels or equipment will be installed. ' +
            'Or skip this and measure runs and items directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for roof or ground-mount panel arrays. ' +
            'Use the Line / Multi-Line tools for cable and conduit runs. ' +
            'Use Point for inverters, isolators, meters, and items priced per unit.',
        needAreaPrompt: 'Do you want to define an installation area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one component before it can be saved. ' +
            "We'll take you back so you can add one.",
        customerQuoteSectionLabel: 'Solar Installation',
        measurementTypeLabels: {
            multi_lineal: 'Multiple Cable / Conduit Runs',
            curved_line: 'Curved Cable Run',
            hours_days: 'Hours / Days',
            count: 'Count (panels / inverters / fittings)',
            volume: 'Volume',
        },
    },
    construction: {
        tradeLabel: 'Construction',
        featureLabel: 'Drawings & Images',
        featureLabelSingular: 'Drawing/Image',
        areaPluralLabel: 'Areas',
        areaSingularLabel: 'Area',
        addAreaCta: 'Add Area',
        pitchRequired: false,
        pitchOptional: true,
        pitchHidesValleyHip: true,
        pitchCheckboxLabel: 'Apply Angle/Slope calculation',
        pitchRafterLabel: 'Rise over run',
        areaPitchLabel: 'Pitch (°)',
        createAreaModalTitle: 'Create Area',
        areaNamePlaceholder: 'e.g. Zone A, Ground Floor, Extension',
        areaIsOptional: true,
        firstAreaInstructionsTitle: 'Define Your Areas',
        firstAreaInstructionsBody: 'For area-based components you can draw an area now. ' +
            'For lineal or count-based work you can skip this and measure directly.',
        firstAreaConfirmCta: 'Yes, add an area',
        toolGuidanceNote: 'Use the Area tool for room or zone outlines. ' +
            'Use the Line / Multi-Line tools for lineal runs (footings, framing, trim, fence lines). ' +
            'Use the Curved Line tool for curved paths or edges. ' +
            'Use Point for items priced per unit. ' +
            'Enable pitch on individual components when measuring roof work from plan view.',
        needAreaPrompt: 'Do you want to measure an area first?',
        optionalAreaConfirmCta: 'Yes, add an area',
        skipAreaCta: 'No, skip',
        builderStepLabel: 'Areas',
        emptyAreaGuardMessage: 'A quote needs at least one area and one main component before it can be saved. ' +
            "We'll take you back to Areas so you can add one.",
        customerQuoteSectionLabel: 'Construction Works',
        measurementTypeLabels: {},
    },
};
/**
 * Safe accessor: falls back to roofing labels for unknown / legacy trade
 * values so a stale database row never breaks the UI.
 */
function getTradeLabels(trade) {
    if (trade === 'cladding')
        return exports.TRADE_LABELS.cladding;
    if (trade === 'generic')
        return exports.TRADE_LABELS.generic;
    if (trade === 'electrical')
        return exports.TRADE_LABELS.electrical;
    if (trade === 'plumbing')
        return exports.TRADE_LABELS.plumbing;
    if (trade === 'landscaping')
        return exports.TRADE_LABELS.landscaping;
    if (trade === 'flooring')
        return exports.TRADE_LABELS.flooring;
    if (trade === 'tiling')
        return exports.TRADE_LABELS.tiling;
    if (trade === 'foundations')
        return exports.TRADE_LABELS.foundations;
    if (trade === 'insulation')
        return exports.TRADE_LABELS.insulation;
    if (trade === 'painting')
        return exports.TRADE_LABELS.painting;
    if (trade === 'fencing')
        return exports.TRADE_LABELS.fencing;
    if (trade === 'concrete')
        return exports.TRADE_LABELS.concrete;
    if (trade === 'construction')
        return exports.TRADE_LABELS.construction;
    if (trade === 'solar')
        return exports.TRADE_LABELS.solar;
    return exports.TRADE_LABELS.roofing;
}

},"@drawings":function(require,module,exports){
exports.loadFlashingLibrary=async()=>[{id:'image-1',name:'Apron flashing',description:'Sample drawing',image_url:''}];
},"@restore":function(require,module,exports){
exports.loadCalcDraftAsync=async()=>null;exports.clearCalcDraft=()=>{};
},"@publish":function(require,module,exports){
exports.PublishLibraryModal=()=>null;
}};const cache={};function require(id){if(id==='react')return React;if(id==='react-dom')return ReactDOM;if(id==='react/jsx-runtime')return {Fragment:React.Fragment,jsx:(t,p,k)=>React.createElement(t,k===undefined?p:{...p,key:k}),jsxs:(t,p,k)=>React.createElement(t,k===undefined?p:{...p,key:k})};if(cache[id])return cache[id].exports;const m={exports:{}};cache[id]=m;if(!modules[id])throw Error('Unknown module '+id);modules[id](require,m,m.exports);return m.exports;}window.sourceRequire=require;window.React=React;window.ReactDOM=ReactDOM;