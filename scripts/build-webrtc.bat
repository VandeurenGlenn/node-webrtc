@ECHO OFF
SET EL=0

ECHO Add depot_tools to PATH
set PATH=%DEPOT_TOOLS%;%PATH%
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

ECHO ninja
call ninja webrtc api/video:adapted_video_track_source api/video_codecs:builtin_video_decoder_factory api/video_codecs:builtin_video_encoder_factory -j 2
IF %ERRORLEVEL% NEQ 0 GOTO ERROR

GOTO DONE

:ERROR
ECHO ERRORLEVEL^: %ERRORLEVEL%
SET EL=%ERRORLEVEL%

:DONE

EXIT /b %EL%
