Pod::Spec.new do |s|
  s.name           = 'ExpoPansBleApi'
  s.version        = '1.0.0'
  s.summary        = 'DWM1001 PANS BLE GATT transport for Expo apps'
  s.description    = 'Native Android/iOS BLE transport for DWM1001 PANS GATT characteristics.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1',
    :tvos => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
