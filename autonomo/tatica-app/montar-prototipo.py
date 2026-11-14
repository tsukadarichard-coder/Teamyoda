"""Monta o protótipo do QuadraLab Tática num arquivo só (para abrir no celular ou no computador sem servidor).
Uso: python3 autonomo/tatica-app/montar-prototipo.py <arquivo-de-saida.html>
Junta app.css, o manual (mty/situacoes-jogo.js), app.js e o Simulador de Decisões (autonomo/decisoes) num HTML.
Protótipo: não publicar (pedido do Richard em 14/11/2026)."""
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
DEC = os.path.join(RAIZ, "autonomo", "decisoes")


def ler(*partes):
    with open(os.path.join(*partes), encoding="utf-8") as f:
        return f.read()


def sem_fim_script(t):
    assert "</script" not in t.lower(), "um script tem </script> no texto"
    return t


# simulador: o index dele com o CSS e os scripts dentro, sem o cabeçalho e sem os convites da consultoria (que está parada)
sim = ler(DEC, "index.html")
corpo = re.search(r"<!--CORPO-->(.*)<!--/CORPO-->", sim, re.S).group(1)
corpo = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>" + sem_fim_script(ler(DEC, m.group(1))) + "</script>", corpo)
css_sim = ('.topo,.rodape,.convite,a[href="#consultoria"],a[href="#modulo"],a[href*="player"],.pular{display:none!important}'
           'body{padding-top:0!important;background:#fff!important}')
sim_html = ('<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">'
            "<style>" + ler(DEC, "decisoes.css") + "</style><style>" + css_sim + "</style>" + corpo)

idx = ler(AQUI, "index.html")
idx = idx.replace('<link rel="stylesheet" href="app.css">', "<style>" + ler(AQUI, "app.css") + "</style>")
carregar_sim = ('<template id="simTpl">' + sim_html + "</template>\n<script>(function(){var t=document.getElementById('simTpl');"
                "var h='<!doctype html><html lang=\"pt-BR\"><head></head><body>'+t.innerHTML+'</body></html>';"
                "window.QLT_SIM_URL=URL.createObjectURL(new Blob([h],{type:'text/html'}));})();</script>\n")
idx = idx.replace('<script src="../../mty/situacoes-jogo.js"></script>', carregar_sim + "<script>" + sem_fim_script(ler(RAIZ, "mty", "situacoes-jogo.js")) + "</script>")
idx = idx.replace('<script src="manual-completo.js"></script>', "<script>" + sem_fim_script(ler(AQUI, "manual-completo.js")) + "</script>")
idx = idx.replace('<script src="app.js"></script>', "<script>" + sem_fim_script(ler(AQUI, "app.js")) + "</script>")
assert 'src="app.js"' not in idx and 'src="manual-completo.js"' not in idx and "situacoes-jogo.js\"" not in idx

saida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "quadralab-tatica-prototipo.html")
with open(saida, "w", encoding="utf-8") as f:
    f.write(idx)
print(saida, round(len(idx.encode("utf-8")) / 1024), "KB")
