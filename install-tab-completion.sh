#!/usr/bin/env bash
if [[ $OSTYPE == 'darwin'* ]]; then
#MAC OS
./cceb completion >> ~/.bash_profile
else
./cceb completion >> ~/.bashrc
fi
