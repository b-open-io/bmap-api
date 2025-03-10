export const explorerTemplate = (name: string, code: string) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        font-family: 'Helvetica Neue', helvetica, arial;
        font-size: 12px;
        margin: 0;
        background: #2a2a2a;
      }
      .content {
        border-bottom: 1px rgba(255, 255, 255, 0.1) solid;
      }
      .container {
        background: #2a2a2a;
        color: white;
      }
      header {
        display: flex;
        align-items: center;
      }
      .flexible {
        flex-grow: 1;
      }
      header > a {
        display: inline-block;
        color: white;
        font-family: 'Helvetica Neue', helvetica, arial;
        font-size: 12px;
        text-decoration: none;
        font-weight: bold;
      }
      header > .item {
        font-weight: bold;
        border-left: 1px solid rgba(255, 255, 255, 0.3);
        font-size: 12px;
        padding: 0 10px;
        margin: 10px 0;
      }
      header > .dark {
        background: rgba(0, 0, 0, 0.8);
        margin: 0;
        padding: 10px;
        font-weight: bold;
      }
      .align-center {
        text-align: center;
      }
      .table {
        overflow: auto;
      }
      table {
        table-layout: fixed;
        width: 100%;
        border-collapse: collapse;
      }
      th td {
        text-align: center;
      }
      td.top {
        background: rgba(255, 255, 255, 0.05);
        font-weight: bold;
        position: relative;
      }
      td.top i {
        margin-right: 5px;
      }
      td {
        -webkit-transition: width 1s;
        transition: width 1s;
      }
      td.top:hover {
        background: rgba(0, 0, 0, 0.2);
        cursor: pointer;
      }
      td.top.expanded {
        background: rgba(0, 0, 0, 0.2);
        width: 70%;
      }
      td {
        word-wrap: break-word;
        font-size: 12px;
        font-family: Menlo, monaco, courier;
        border: 1px solid rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.8);
        padding: 5px;
      }
      .btn {
        padding: 5px 20px;
        border-radius: 2px;
        text-decoration: none;
        border: 2px solid #2a2a2a;
      }
      .btn-border {
        color: #2a2a2a;
      }
      .btn-filled {
        background: #2a2a2a;
        color: #ffffff;
      }
      #editor {
        width: 100%;
        height: 200px;
        border-top: 1px solid rgba(0, 0, 0, 0.3);
        border-bottom: 1px solid rgba(0, 0, 0, 0.3);
      }
      .label {
        background: rgba(0, 0, 0, 0.3);
        color: gold;
        font-weight: bold;
        padding: 5px 10px;
      }
      button {
        padding: 10px;
        background: gold;
        border: none;
        font-size: 14px;
      }
      button:focus {
        outline: 0;
      }
      .spinner {
        color: white;
        text-align: center;
        padding: 100px;
      }
      input.url:focus {
        outline: none;
      }
      input.url {
        padding: 10px;
        background: rgba(0, 0, 0, 0.8);
        border: none;
        color: white;
        font-family: Menlo, monaco, Courier;
        font-size: 11px;
        transition: background 1000ms ease-in;
        border-radius: 0;
        -webkit-appearance: none;
        appearance: none;
      }
      input.url.updated {
        background: gold;
      }
      a.brand {
        margin: 10px;
        font-size: 16px;
        font-family: 'Helvetica Neue', helvetica, arial;
      }
      a.brand img {
        height: 25px;
      }
      .flex {
        display: flex;
      }
      .label {
        padding: 10px;
      }
      td.cell {
        max-height: 100px;
      }
    </style>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.3.1/css/all.css" />
    <script src="//cdnjs.cloudflare.com/ajax/libs/ace/1.4.1/ace.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/ace/1.4.1/mode-json.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.1.2/handlebars.min.js"></script>
    <script id="grid-template" type="text/x-handlebars-template">
      <table>
        <tr>
          {{#each keys}}
            <td class='top {{this}}'>
              <i class='fas fa-expand-arrows-alt'></i>{{this}}
            </td>
          {{/each}}
        </tr>
        {{#each items}}
          <tr>
            {{#each values}}
              <td valign='top' class='cell {{k}}' data-value='{{{fv}}}'>
                {{{v}}}
              </td>
            {{/each}}
          </tr>
        {{/each}}
      </table>
    </script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
    <script>
      const urlSegments = window.location.pathname.split('/')
      const collectionName = urlSegments[2]
      var endpoint = \`\${window.location.origin}/q/\${collectionName}/\`

      var source = document.getElementById('grid-template').innerHTML
      var template = Handlebars.compile(source)
      var editor
      document.addEventListener('DOMContentLoaded', function (e) {
        editor = ace.edit('editor')
        editor.setTheme('ace/theme/mono_industrial')
        editor.session.setMode('ace/mode/json')
        editor.setShowPrintMargin(false)
        editor.setOptions({
          maxLines: Infinity,
          minLines: 3,
          tabSize: 2,
          useSoftTabs: true,
        })
        editor.getSession().on('change', function () {
          var query = editor.getValue()
          history.pushState(
            null,
            null,
            window.location.origin +
              '/query/' +
              encodeURIComponent(collectionName) +
              '/' +
              btoa(query)
          )
          updateUrl(query)
        })
        run()
        document.querySelector('#query').addEventListener('click', function (e) {
          run()
        })
        document.body.addEventListener('click', function (e) {
          if (e.target.classList.contains('top')) {
            if (e.target.classList.contains('expanded')) {
              e.target.classList.remove('expanded')
            } else {
              e.target.classList.add('expanded')
            }
          } else if (e.target.classList.contains('cell')) {
            if (e.target.children.length === 0) {
              let val = e.target.dataset.value
              if (val && val.length > 0) {
                e.target.textContent = val
              }
            }
          }
        })
      })
      var run = function () {
        var query = editor.getValue()
        console.log('query = ', query)
        try {
          var parsed = JSON.parse(query)
          updateUrl(query)
          document.querySelector('main .window').innerHTML =
            "<div class='spinner'><i class='fas fa-4x fa-circle-notch fa-spin'></i></div>"
          fetch(endpoint + btoa(query))
            .then(function (r) {
              return r.json()
            })
            .then(function (r) {
              document.querySelector('.window').innerHTML = ''
              console.log('setting to', r)
              Object.keys(r).forEach(function (k) {
                render(k, r[k])
              })
            })
        } catch (e) {
          console.log('query invalid json', e)
        }
      }
      var updateUrl = function (query) {
        var base64 = btoa(query)
        var u = document.querySelector('.url')
        u.value = endpoint + base64
        u.classList.add('updated')
        setTimeout(function () {
          u.classList.remove('updated')
        }, 500)
      }
      var matryoshka = function (nested_keys, rows) {
        return rows.map(function (row) {
          return {
            values: nested_keys.map(function (k) {
              if (!row) {
                return { k: null, v: null }
              } else if (Array.isArray(row[k]) && typeof row[k][0] === 'object') {
                let nested_nested_keys = []
                for (let i = 0; i < row[k].length; i++) {
                  if (row[k][i]) {
                    let kk = Object.keys(row[k][i])
                    kk.forEach(function (_k) {
                      if (nested_nested_keys.indexOf(_k) < 0) {
                        nested_nested_keys.push(_k)
                      }
                    })
                  }
                }
                var rendered = matryoshka(nested_nested_keys, row[k])
                let nested_nested = template({
                  keys: nested_nested_keys,
                  items: rendered,
                })
                return { k: null, v: nested_nested }
              } else if (typeof row[k] === 'object' && row[k]) {
                var c = JSON.stringify(row[k], null, 2)
                return { k: k, v: '<pre>' + c + '</pre>' }
              } else {
                if (row[k] && row[k].toString().length > 200) {
                  return {
                    k: k,
                    fv: Handlebars.Utils.escapeExpression(row[k]),
                    v: Handlebars.Utils.escapeExpression(row[k].slice(0, 200) + '...'),
                  }
                } else {
                  return {
                    k: k,
                    fv: Handlebars.Utils.escapeExpression(row[k]),
                    v: Handlebars.Utils.escapeExpression(row[k]),
                  }
                }
              }
            }),
          }
        })
      }
      var render = function (selector, items) {
        if (!Array.isArray(items)) {
          items = [items]
        }
        var d = document.createElement('div')
        d.setAttribute('id', selector)
        var c = document.createElement('div')
        c.setAttribute('class', 'content')
        var l = document.createElement('div')
        l.setAttribute('class', 'label')
        l.innerHTML = selector + ' (' + items.length + ')'
        d.appendChild(l)
        d.appendChild(c)
        document.querySelector('.window').appendChild(d)
        if (items.length > 0) {
          items.forEach(function (item, i) {
            if (typeof item !== 'object') {
              items[i] = { _: item }
            }
          })
          var copied_items = JSON.parse(JSON.stringify(items))
          var sorted_items = copied_items.sort(function (a, b) {
            return Object.keys(b).length - Object.keys(a).length
          })
          var keys = Object.keys(sorted_items[0])
            .sort(function (a, b) {
              return a.length - b.length
            })
            .filter(function (k) {
              return k !== '_id'
            })
          d.querySelector('.content').innerHTML = template({
            keys: keys,
            items: items.map(function (i) {
              return {
                values: keys.map(function (key) {
                  if (Array.isArray(i[key])) {
                    if (i[key].length > 0) {
                      let first_row = null
                      for (let k = 0; k < i[key].length; k++) {
                        if (i[key][k]) {
                          if (first_row) {
                            if (Object.keys(i[key][k]).length > Object.keys(first_row).length) {
                              first_row = i[key][k]
                            }
                          } else {
                            first_row = i[key][k]
                          }
                        }
                      }
                      let rows = i[key]
                      if (typeof first_row === 'object' && first_row !== null) {
                        let nested_keys = Object.keys(first_row)
                        var rendered = matryoshka(nested_keys, rows)
                        let nested = template({
                          keys: nested_keys,
                          items: rendered,
                        })
                        return { k: null, v: nested }
                      } else {
                        return { k: null, v: JSON.stringify(rows, null, 2) }
                      }
                    } else {
                      return { k: null, v: '' }
                    }
                  } else if (typeof i[key] === 'object' && i[key] !== null) {
                    let row = i[key]
                    if (row) {
                      let rows = [row]
                      let nested_keys = Object.keys(row)
                      var rendered = matryoshka(nested_keys, rows)
                      let nested = template({
                        keys: nested_keys,
                        items: rendered,
                      })
                      return { k: null, v: nested }
                    } else {
                      return { k: null, v: '' }
                    }
                  } else {
                    return {
                      k: null,
                      v: Handlebars.Utils.escapeExpression(i[key]),
                    }
                  }
                }),
              }
            }),
          })
        }
      }
    </script>
  </head>
  <body>
    <div class="container">
      <header>
        <a href="/" class="brand">${name}</a>
        <div class="flexible"></div>
        <a href="https://map.sv" class="item">Docs</a>
      </header>
      <div class="jumbotron align-center header">
        <div id="editor">${code}</div>
        <div class="flex">
          <span class="label">API endpoint</span>
          <input readonly class="flexible url" />
          <button id="query">Run query</button>
        </div>
      </div>
    </div>
    <main>
      <div class="window"></div>
    </main>
  </body>
</html>`;
