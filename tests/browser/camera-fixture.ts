import{test as base,type BrowserContextOptions}from'@playwright/test';
// Chrome precisa liberar o dispositivo fictício entre cenários de getUserMedia.
export const test=base.extend({context:async({playwright,browserName,launchOptions,baseURL},provide,info)=>{
  const browser=await playwright[browserName].launch(launchOptions);const options:BrowserContextOptions={baseURL};
  for(const key of['viewport','screen','isMobile','hasTouch','deviceScaleFactor','userAgent','colorScheme','locale','timezoneId','reducedMotion']as const)if(info.project.use[key]!==undefined)Object.assign(options,{[key]:info.project.use[key]});
  const context=await browser.newContext(options);try{await provide(context);}finally{await context.close();await browser.close();}
}});
