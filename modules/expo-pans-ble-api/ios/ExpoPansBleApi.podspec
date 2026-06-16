Pod::Spec.new do |s|
  s.name           = 'ExpoPansBleApi'
  s.version        = '1.0.0'
  s.summary        = 'Expo native module wrapper for DWM1001 PANS BLE devices'
  s.description    = 'Expo Modules wrapper for DWM1001 PANS BLE scanning, connection, GATT characteristics, and localization helpers.'
  s.author         = 'Eight2Five'
  s.homepage       = 'https://github.com/CDGuth/Eight2Five'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: 'https://github.com/CDGuth/Eight2Five.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
