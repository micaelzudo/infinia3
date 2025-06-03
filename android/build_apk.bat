@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\Micael\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%

echo Building APK...
call .\gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! APK location:
    dir /s /b *.apk
) else (
    echo.
    echo Build failed with error code %ERRORLEVEL%
)

pause
