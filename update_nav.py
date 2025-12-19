from pathlib import Path

path = Path('public/index.html')
text = path.read_text(encoding='utf-8')

if 'data-target="facturas"' not in text:
    needle = """          <button class=\"menu-item\" data-target=\"pedidos\">
            <span class=\"icon\">\U0001f9fe</span>
            <span class=\"label\">Pedidos</span>
          </button>
"""
    new_block = needle + """          <div class=\"menu-group open\" data-group=\"contabilidad\">
            <button class=\"menu-item menu-parent\" data-toggle=\"contabilidad\">
              <span class=\"icon\">$</span>
              <span class=\"label\">Contabilidad</span>
              <span class=\"caret\">></span>
            </button>
            <div class=\"submenu\" data-parent=\"contabilidad\">
              <button class=\"menu-item submenu-item\" data-target=\"facturas\">
                <span class=\"icon\">#</span>
                <span class=\"label\">Facturas</span>
              </button>
            </div>
          </div>
"""
    if needle not in text:
        raise SystemExit('Needle not found')
    text = text.replace(needle, new_block, 1)

if 'id="view-facturas"' not in text:
    anchor = '  <div class="modal-overlay" id="merc-chart-overlay">'
    section = """
  <section class=\"view hidden\" id=\"view-facturas\">
    <article class=\"card wide\">
      <div class=\"actions between\">
        <div>
          <h2>Facturas</h2>
          <p class=\"status\">Panel contable para consultar facturas.</p>
        </div>
        <span class=\"tag\">Contabilidad</span>
      </div>
      <div class=\"card-body\">
        <p class=\"status\">Selecciona el submenu \"Facturas\" para ver esta vista.</p>
        <p class=\"muted\">
          Aquí podrás sumar filtros y reportes contables. Si necesitas un listado o consultas específicas,
          avisá y lo agregamos.
        </p>
      </div>
    </article>
  </section>
"""
    if anchor not in text:
        raise SystemExit('Anchor not found')
    text = text.replace(anchor, section + anchor, 1)

path.write_text(text, encoding='utf-8')
