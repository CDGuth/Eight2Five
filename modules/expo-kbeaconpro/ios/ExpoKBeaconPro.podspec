Pod::Spec.new do |s|
  s.name           = 'ExpoKBeaconPro'
  s.version        = '1.0.0'
  s.summary        = 'Expo native module wrapper for KKM KBeaconPro BLE devices'
  s.description    = 'Expo Modules wrapper for KBeaconPro scanning, connection, configuration, and sensor operations.'
  s.author         = 'Eight2Five'
  s.homepage       = 'https://github.com/CDGuth/Eight2Five'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: 'https://github.com/CDGuth/Eight2Five.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'kbeaconlib2', '1.2.1'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
