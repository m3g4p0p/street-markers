import { Select, Translate } from 'ol/interaction'
import { Marker } from './map'
import { toLonLat } from 'ol/proj'
import { SelectEvent, SelectEventType } from 'ol/interaction/Select'
import VectorLayer from 'ol/layer/Vector'
import { initEditor } from './editor'
import { getName } from './nonsense'

const SELECT = 'select' as SelectEventType

function getInfo (marker: Marker) {
  const info = marker.get('info')
  return info ? info.innerHTML.trim() : ''
}

function setInfo (marker: Marker, value: string) {
  const info = marker.get('info')
  info.innerHTML = value
  return value.trim().length > 0
}

function setLocation (marker: Marker, form: HTMLFormElement) {
  const lon = Number(form.elements['lon'].value)
  const lat = Number(form.elements['lat'].value)

  marker.set('location', [lon, lat])
}

function focusInput (element: HTMLInputElement) {
  element.focus()
  element.selectionStart = 0
  element.selectionEnd = element.value.length
}

function updateLink (form: HTMLFormElement, layer: VectorLayer) {
  const link = document.getElementById('link') as HTMLAnchorElement
  const features = layer.getSource().getFeatures()
  const params = new URLSearchParams()
  const { origin, pathname } = window.location

  params.append('noedit', '1')
  params.append('markers', JSON.stringify(features))

  form.elements['link'].value = link.href = origin + pathname + '?' + params
}

export function initControls (form: HTMLFormElement, layer: VectorLayer, select: Select) {
  const addButton = form.elements['add-marker'] as HTMLButtonElement
  const removeButton = form.elements['remove-marker'] as HTMLButtonElement
  const clearButton = form.elements['clear-markers'] as HTMLButtonElement
  const infoEditor = initEditor(form.elements['info'])

  const translate = new Translate({
    features: select.getFeatures()
  })

  const map = select.getMap()
  let marker: Marker = null

  map.addInteraction(translate)
  updateLink(form, layer)

  select.on('select', event => {
    [marker = null] = event.selected as Marker[]

    if (!marker) {
      addButton.disabled = false
      removeButton.disabled = true

      return form.reset()
    }

    const [lon, lat] = marker.get('location')

    form.elements['name'].value = marker.get('name')
    form.elements['lon'].value = lon
    form.elements['lat'].value = lat
    infoEditor.value = getInfo(marker)
    addButton.disabled = true
    removeButton.disabled = false
  })

  translate.on('translateend', event => {
    const [lon, lat] = toLonLat(event.coordinate)

    form.elements['lon'].value = lon
    form.elements['lat'].value = lat
    marker.set('location', [lon, lat])
    updateLink(form, layer)
  })

  addButton.addEventListener('click', async () => {
    const center = map.getView().getCenter()

    const marker = new Marker({
      name: await getName(form),
      location: toLonLat(center),
      infoHTML: form.elements['info'].value
    })

    const event = new SelectEvent(SELECT, [marker], [], null)

    select.getFeatures().push(marker)
    layer.getSource().addFeature(marker)
    select.dispatchEvent(event)
    focusInput(form.elements['name'])
    updateLink(form, layer)
  })

  removeButton.addEventListener('click', () => {
    const source = layer.getSource()
    const event = new SelectEvent(SELECT, [], [marker], null)

    source.removeFeature(marker)
    select.dispatchEvent(event)
    updateLink(form, layer)
  })

  clearButton.addEventListener('click', () => {
    if (window.confirm('Sure about that?')) {
      layer.getSource().clear()
      form.reset()
      updateLink(form, layer)
    }
  })

  form.addEventListener('input', event => {
    if (!marker) {
      return
    }

    const { name, value } = event.target as HTMLInputElement

    switch (name) {
      case 'name': {
        marker.set(name, value)
        break
      }

      case 'info': {
        const show = setInfo(marker, value)
        marker.toggleInfo(map, show)
        break
      }

      case 'lon':
      case 'lat': {
        setLocation(marker, form)
      }
    }
  })
}
