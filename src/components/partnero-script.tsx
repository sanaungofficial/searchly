"use client";

import Script from "next/script";

const PROGRAM_ID = process.env.NEXT_PUBLIC_PARTNERO_PROGRAM_ID;

/** Loads PartneroJS — sets partnero_referral cookie on ?ref= visits. */
export function PartneroScript() {
  if (!PROGRAM_ID) return null;

  return (
    <>
      <Script id="partnero-init" strategy="afterInteractive">
        {`
(function(p,t,n,e,r,o){ p['__partnerObject']=r;function f(){
var c={ a:arguments,q:[]};var r=this.push(c);return "number"!=typeof r?r:f.bind(c.q);}
f.q=f.q||[];p[r]=p[r]||f.bind(f.q);p[r].q=p[r].q||f.q;o=t.createElement(n);
var _=t.getElementsByTagName(n)[0];o.async=1;o.src=e+'?v'+(~~(new Date().getTime()/1e6));
_.parentNode.insertBefore(o,_);})(window, document, 'script', 'https://app.partnero.com/js/universal.js', 'po');
po('settings', 'assets_host', 'https://assets.partnero.com');
po('program', '${PROGRAM_ID}', 'load');
        `}
      </Script>
    </>
  );
}
