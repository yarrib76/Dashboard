const fs = require('fs');
let txt = fs.readFileSync('public/index.html','utf8');
const pattern = /<table class=\ table\ id=\tabla-clientes\>[\s\S]*?<\/table>/;
const repl = <table class=\table\ id=\tabla-clientes\>
              <thead>
                <tr>
                  <th data-sort=\nombre\>Nombre</th>
                  <th data-sort=\apellido\>Apellido</th>
                  <th data-sort=\mail\>Email</th>
                  <th data-sort=\telefono\>Teléfono</th>
                  <th data-sort=\updated_at\>Actualizado</th>
                  <th data-sort=\ultimaCompra\>Última compra</th>
                  <th data-sort=\cantFacturas\>Compras</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>;
if(!pattern.test(txt)) { console.error('pattern not found'); process.exit(1); }
txt = txt.replace(pattern, repl);
fs.writeFileSync('public/index.html', txt);
console.log('patched');
