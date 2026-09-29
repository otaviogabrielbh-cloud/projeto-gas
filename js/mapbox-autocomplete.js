const mapboxToken = '';

document.addEventListener('DOMContentLoaded', () => {
    const enderecoInput = document.getElementById('endereco');
    if (!enderecoInput) return;

    const pacContainer = document.createElement('div');
    pacContainer.className = 'pac-container';
    pacContainer.style.display = 'none';
    pacContainer.style.position = 'absolute';
    pacContainer.style.zIndex = '99999';
    pacContainer.style.background = 'white';
    
    // Tenta encontrar o wrapper mais proximo do input para posicionamento absoluto
    const wrapper = enderecoInput.parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(pacContainer);

    let debounceTimeout;

    enderecoInput.addEventListener('input', function() {
        clearTimeout(debounceTimeout);
        const query = this.value;
        if (query.length < 4) {
            pacContainer.style.display = 'none';
            return;
        }
        
        debounceTimeout = setTimeout(() => {
            // O param country=br e proximity pode ajudar, vamos focar no BR
            // bbox do RS pode ser adicionado se quiser restringir, mas o Mapbox é bom
            // bbox para Minas Gerais: minLon,minLat,maxLon,maxLat
            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&country=br&bbox=-51.046,-22.923,-39.855,-14.238&autocomplete=true&proximity=-43.9378,-19.9208`)
            .then(response => response.json())
            .then(data => {
                pacContainer.innerHTML = '';
                if (data.features && data.features.length > 0) {
                    // Filtra apenas os resultados que tem 'Minas Gerais' no nome ou no contexto
                    const featuresFiltradas = data.features.filter(f => f.place_name.includes('Minas Gerais') || (f.context && f.context.some(c => c.text === 'Minas Gerais' || c.short_code === 'BR-MG')));
                    if(featuresFiltradas.length > 0) {
                    featuresFiltradas.forEach(feature => {
                        const pacItem = document.createElement('div');
                        pacItem.className = 'pac-item';
                        
                        const pacItemQuery = document.createElement('span');
                        pacItemQuery.className = 'pac-item-query';
                        
                        // Remove ' Brazil' ou ' Brasil' do final do texto e partes
                        const nomeLimpo = feature.place_name.replace(/,\s*Braz?il$/i, '');
                        const partes = nomeLimpo.split(', ');
                        pacItemQuery.textContent = partes[0] + (partes[1] ? ', ' + partes[1] : '');
                        
                        const small = document.createElement('span');
                        small.style.color = '#70757a';
                        small.style.fontSize = '12px';
                        small.style.marginLeft = '8px';
                        small.textContent = partes.slice(2).join(', ');
                        
                        pacItem.appendChild(pacItemQuery);
                        if (partes.length > 2) pacItem.appendChild(small);
                        
                        pacItem.onclick = function() {
                            // Quando clica, preenche o input
                            enderecoInput.value = nomeLimpo;
                            pacContainer.style.display = 'none';
                            
                            // Se houver um input oculto de coordenadas, poderiamos salvar
                            // feature.geometry.coordinates[0] (lon) e [1] (lat)
                        };
                        
                        pacContainer.appendChild(pacItem);
                    });
                    
                    // Posiciona o menu abaixo do input
                    pacContainer.style.top = (enderecoInput.offsetHeight + 4) + 'px';
                    pacContainer.style.left = '0';
                    pacContainer.style.width = '100%';
                    pacContainer.style.display = 'block';
                    } else { pacContainer.style.display = 'none'; }
                } else {
                    pacContainer.style.display = 'none';
                }
            }).catch(e => console.error('Erro no Mapbox:', e));
        }, 400); // 400ms debounce
    });

    document.addEventListener('click', function(e) {
        if (e.target !== enderecoInput && !pacContainer.contains(e.target)) {
            pacContainer.style.display = 'none';
        }
    });
});
