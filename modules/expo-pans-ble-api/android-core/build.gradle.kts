plugins {
  kotlin("jvm") version "2.1.20"
}


dependencies {
  testImplementation(kotlin("test"))
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.test {
  useJUnitPlatform()

  reports {
    junitXml.required.set(true)
    html.required.set(true)
  }

  testLogging {
    events("passed", "skipped", "failed")
  }
}
