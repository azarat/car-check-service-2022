import { JSDOM } from 'jsdom'

const generateVinTabsObj = (keys: string[], data: string[]) => {
  const obj: { [key: string]: string } = {};
  for (const key of keys) {
    const dataEl: string = data[keys.indexOf(key)];
    if (dataEl) {
      obj[key] = dataEl;
    }
  }

  return obj;
}

const getJsonDataFromHtml = (html: string): any => {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const finalJson = {};

  Array.from(document.querySelectorAll("#vinTabs > div")).forEach(div => {

    const id: string = div.id;
    const elemsArray = [];
    const keys: string[] = [];

    Array.from(document.querySelectorAll(`#${div.id} > table > thead > tr > th`)).forEach(th => {
      if (th.textContent && th.textContent.trim()) {
        keys.push(th.textContent);
      }

    })

    Array.from(document.querySelectorAll(`#${div.id} > table > tbody > tr`)).forEach(tr => {
      const args: string[] = [];

      Array.from(tr.children).forEach(element => {
        if (element.textContent && element.textContent.trim()) {
          args.push(element.textContent.replace(/\r?\n?\s{2,}/g, ""));
        } else {
          args.push("");
        }
      })

      if (args[0]) {
        if (keys.length) {
          elemsArray.push(generateVinTabsObj(keys, args))
        } else {
          elemsArray.push(generateVinTabsObj(["title", "data"], args));
          if (args[2]) {
            switch (args.length) {
              case 3: elemsArray.push(generateVinTabsObj(["title", "data"], [args[0], `${args[1]} ${args[2]}`]));
                break;
              case 4: elemsArray.push(generateVinTabsObj(["title", "data"], args.slice(2)));
                break;
            }
          }
        }
      }
    })
    finalJson[id] = elemsArray;
  })
  return finalJson;
}

export default getJsonDataFromHtml